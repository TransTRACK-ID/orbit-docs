import { defineEventHandler, readBody, createError } from "h3";
import { streamText } from "ai";
import { customOpenAI } from "~/mastra/openai";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const { messages, docId } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Messages are required",
    });
  }

  const model = customOpenAI.languageModel(process.env.OPENAI_MODEL || "gpt-4o-mini");

  const systemPrompt = docId
    ? `You are a helpful documentation assistant. You are currently viewing a specific document. Answer questions based on the document context. If the context doesn't contain the answer, say so clearly.`
    : `You are a helpful documentation assistant. Answer questions based on the available documentation. If the context doesn't contain the answer, say so clearly.`;

  const result = streamText({
    model,
    system: systemPrompt,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return result.toDataStreamResponse({
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
