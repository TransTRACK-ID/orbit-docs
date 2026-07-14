import { defineEventHandler, readBody, createError, sendWebResponse, type H3Event } from "h3";
import { streamText } from "ai";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { getSessionToken } from "~/server/utils/auth";
import { createChatAgent } from "~/server/lib/agent-factory";
import { assertDocAgentReady } from "~/server/lib/agent-readiness";
import { resolveChatBackend } from "~/server/lib/chat-backend";
import { getCustomOpenAI } from "~/server/lib/openai";
import {
  buildMultiDocContext,
  findFeatureDocByExternalId,
  listFeatureDocIndex,
  searchFeatureDocs,
} from "~/server/lib/feature-doc-search";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatContextOptions {
  docId?: string;
  appId?: string;
  featureId?: string;
  module?: string;
  messages: ChatMessage[];
}

function buildChatPrompt(systemPrompt: string, messages: ChatMessage[]): string {
  const lines = messages.map((m) => {
    const label = m.role === "assistant" ? "Assistant" : "User";
    return `${label}: ${m.content}`;
  });

  return `${systemPrompt}

---

${lines.join("\n\n")}

Respond as the Assistant. Be concise and helpful. Answer from the document context only — do not explore the filesystem.`;
}

function canAccessDoc(status: string, event: H3Event): boolean {
  if (status === "published") return true;
  return !!getSessionToken(event);
}

async function loadSingleDocContext(
  event: H3Event,
  docId: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ title: docs.title, content: docs.content, status: docs.status })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1);

  const doc = rows[0];
  if (!doc?.content || !canAccessDoc(doc.status, event)) {
    return null;
  }

  return `You are a helpful documentation assistant. You are currently viewing a document titled "${doc.title || "Untitled"}". Here is the document content:

---
${doc.content}
---

Answer questions based on the document context above. If the context doesn't contain the answer, say so clearly.`;
}

async function buildSystemPrompt(event: H3Event, options: ChatContextOptions): Promise<string> {
  const fallback =
    "You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.";

  let resolvedDocId = options.docId;

  if (!resolvedDocId && options.appId && options.featureId) {
    const featureDoc = await findFeatureDocByExternalId(options.appId, options.featureId);
    if (featureDoc) {
      resolvedDocId = featureDoc.id;
    }
  }

  if (resolvedDocId) {
    const singleDocPrompt = await loadSingleDocContext(event, resolvedDocId);
    if (singleDocPrompt) return singleDocPrompt;
  }

  if (options.appId) {
    const publishedOnly = !getSessionToken(event);
    const lastUserMessage = [...options.messages]
      .reverse()
      .find((m) => m.role === "user" && m.content.trim())?.content;

    const query = lastUserMessage?.trim() || "";
    const matchedDocs = await searchFeatureDocs({
      appId: options.appId,
      query,
      module: options.module,
      publishedOnly,
      limit: 8,
    });

    const index = await listFeatureDocIndex({
      appId: options.appId,
      module: options.module,
      publishedOnly,
      limit: 50,
    });

    if (matchedDocs.length > 0 || index.length > 0) {
      const context = buildMultiDocContext(matchedDocs, index);
      return `You are a helpful product documentation assistant for this application. Use the feature documentation below to answer questions.

${context}

If the context does not contain the answer, say so clearly and suggest which module or feature the user might mean.`;
    }
  }

  return fallback;
}

function startPlainTextStream(event: H3Event) {
  const res = event.node.res;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { messages, docId, appId, featureId, module } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Messages are required",
    });
  }

  const backend = resolveChatBackend();
  const chatMessages = messages.map((m: ChatMessage) => ({
    role: m.role,
    content: m.content,
  }));

  const systemPrompt = await buildSystemPrompt(event, {
    docId: typeof docId === "string" ? docId : undefined,
    appId: typeof appId === "string" ? appId : undefined,
    featureId: typeof featureId === "string" ? featureId : undefined,
    module: typeof module === "string" ? module : undefined,
    messages: chatMessages,
  });

  if (backend === "openrouter") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw createError({
        statusCode: 503,
        statusMessage: "Service Unavailable",
        message: "CHAT_BACKEND=openrouter requires OPENAI_API_KEY",
      });
    }

    const model = getCustomOpenAI().chat(process.env.OPENAI_MODEL || "gpt-4o-mini");
    const result = streamText({
      model,
      system: systemPrompt,
      messages: chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return sendWebResponse(
      event,
      result.toTextStreamResponse({
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      }),
    );
  }

  await assertDocAgentReady();

  const agent = createChatAgent();
  const prompt = buildChatPrompt(systemPrompt, chatMessages);
  const abortSignal = (event.node.req as { abortSignal?: AbortSignal }).abortSignal;

  startPlainTextStream(event);

  await new Promise<void>((resolve, reject) => {
    const res = event.node.res;

    const onClose = () => {
      resolve();
    };
    res.on("close", onClose);

    agent
      .analyze(prompt, {
        signal: abortSignal,
        onText: (delta) => {
          if (!delta || res.writableEnded) return;
          res.write(delta);
        },
      })
      .then(() => {
        if (!res.writableEnded) {
          res.end();
        }
        resolve();
      })
      .catch((err) => {
        if (!res.headersSent) {
          reject(err);
          return;
        }
        if (!res.writableEnded) {
          const msg = err instanceof Error ? err.message : "Chat failed";
          res.write(`\n\n[Error: ${msg}]`);
          res.end();
        }
        resolve();
      });
  });
});
