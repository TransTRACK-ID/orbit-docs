import { defineEventHandler, readBody, createError, sendWebResponse } from "h3";
import { streamText } from "ai";
import { getCustomOpenAI } from "~/server/lib/openai";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { getSessionToken } from "~/server/utils/auth";

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

  const model = getCustomOpenAI().chat(process.env.OPENAI_MODEL || "gpt-4o-mini");

  let systemPrompt = `You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.`;

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
        // Check if the user is authenticated for non-published docs
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

  const result = streamText({
    model,
    system: systemPrompt,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Use sendWebResponse so Nitro/h3 passes the ReadableStream through
  // directly without buffering or JSON-serialising the Response object.
  // toTextStreamResponse() emits raw plain text — one token per chunk.
  return sendWebResponse(
    event,
    result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no", // disable nginx buffering in production
      },
    }),
  );
});
