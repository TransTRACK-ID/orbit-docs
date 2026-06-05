import { defineEventHandler, readBody, createError, sendWebResponse } from "h3";
import { streamText } from "ai";
import { getCustomOpenAI } from "~/server/lib/openai";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { messages, docId, docContent, docTitle } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Messages are required",
    });
  }

  const model = getCustomOpenAI().chat(process.env.OPENAI_MODEL || "gpt-4o-mini");

  let systemPrompt = `You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.`;

  if (docContent) {
    systemPrompt = `You are a helpful documentation assistant. You are currently viewing a document titled "${docTitle || "Untitled"}". Here is the document content:

---
${docContent}
---

Answer questions based on the document context above. If the context doesn't contain the answer, say so clearly.`;
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
