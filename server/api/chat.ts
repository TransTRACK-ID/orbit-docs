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

interface ChatMessage {
  role: string;
  content: string;
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

async function buildSystemPrompt(event: H3Event, docId?: string) {
  let systemPrompt =
    "You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.";

  if (!docId) return systemPrompt;

  const db = getDb();
  const rows = await db
    .select({ title: docs.title, content: docs.content, status: docs.status })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1);

  const doc = rows[0];
  let hasAccess = false;

  if (doc?.content) {
    if (doc.status === "published") {
      hasAccess = true;
    } else {
      hasAccess = !!getSessionToken(event);
    }
  }

  if (hasAccess && doc?.content) {
    systemPrompt = `You are a helpful documentation assistant. You are currently viewing a document titled "${doc.title || "Untitled"}". Here is the document content:

---
${doc.content}
---

Answer questions based on the document context above. If the context doesn't contain the answer, say so clearly.`;
  }

  return systemPrompt;
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
  const { messages, docId } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Messages are required",
    });
  }

  const backend = resolveChatBackend();
  const systemPrompt = await buildSystemPrompt(event, docId);
  const chatMessages = messages.map((m: ChatMessage) => ({
    role: m.role,
    content: m.content,
  }));

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
