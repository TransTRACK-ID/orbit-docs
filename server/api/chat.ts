import { defineEventHandler, readBody, createError, sendWebResponse } from "h3";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { getSessionToken } from "~/server/utils/auth";
import { createChatAgent } from "~/server/lib/agent-factory";
import { assertDocAgentReady } from "~/server/lib/agent-readiness";

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

Respond as the Assistant. Be concise and helpful. Do not use tools unless necessary to answer the question.`;
}

export default defineEventHandler(async (event) => {
  await assertDocAgentReady();

  const body = await readBody(event);
  const { messages, docId } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Messages are required",
    });
  }

  let systemPrompt =
    "You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.";

  // Fetch doc content server-side — never trust client-supplied content
  if (docId) {
    const db = getDb();
    const rows = await db
      .select({ title: docs.title, content: docs.content, status: docs.status })
      .from(docs)
      .where(eq(docs.id, docId))
      .limit(1);

    const doc = rows[0];

    // Published docs: anyone can chat about them
    // Non-published docs (draft, in_review): only authenticated users
    let hasAccess = false;
    if (doc?.content) {
      if (doc.status === "published") {
        hasAccess = true;
      } else {
        const token = getSessionToken(event);
        hasAccess = !!token;
      }
    }

    if (hasAccess && doc?.content) {
      systemPrompt = `You are a helpful documentation assistant. You are currently viewing a document titled "${doc.title || "Untitled"}". Here is the document content:

---
${doc.content}
---

Answer questions based on the document context above. If the context doesn't contain the answer, say so clearly.`;
    }
  }

  const agent = createChatAgent();
  const prompt = buildChatPrompt(
    systemPrompt,
    messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    })),
  );

  const abortSignal = (event.node.req as { abortSignal?: AbortSignal }).abortSignal;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let sentLength = 0;
        const result = await agent.analyze(prompt, {
          signal: abortSignal,
          onText: (delta, accumulated) => {
            if (delta) {
              controller.enqueue(encoder.encode(delta));
              sentLength += delta.length;
              return;
            }
            if (accumulated && accumulated.length > sentLength) {
              const chunk = accumulated.slice(sentLength);
              controller.enqueue(encoder.encode(chunk));
              sentLength = accumulated.length;
            }
          },
        });
        if (sentLength === 0 && result) {
          controller.enqueue(encoder.encode(result));
        }
        controller.close();
      } catch (err) {
        if (abortSignal?.aborted) {
          controller.close();
          return;
        }
        controller.error(err);
      }
    },
  });

  return sendWebResponse(
    event,
    new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    }),
  );
});
