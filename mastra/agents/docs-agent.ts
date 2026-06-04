import { Agent } from "@mastra/core";
import { getCustomOpenAI } from "../openai";
import { searchDocsTool } from "../tools/search-docs";

export const docsAgent = new Agent({
  name: "Docs Assistant",
  instructions: `You are a helpful documentation assistant. You help users understand their technical documentation, answer questions about docs, and provide insights based on the document content.

When answering questions:
1. Ground your answers in the provided document context
2. Be concise and technical when appropriate
3. If the context doesn't contain the answer, say so clearly
4. Use markdown formatting for code, lists, and emphasis

You have access to a document search tool that can retrieve relevant sections from the user's documentation.`,
  model: getCustomOpenAI().languageModel(process.env.OPENAI_MODEL || "gpt-4o-mini"),
  tools: {
    searchDocs: searchDocsTool,
  },
});
