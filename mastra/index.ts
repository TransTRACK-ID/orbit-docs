import { createOpenAI } from "@ai-sdk/openai";
import { Mastra } from "@mastra/core";
import { LibSQLVector } from "@mastra/libsql";
import { docsAgent } from "./agents/docs-agent";

const customOpenAI = createOpenAI({
  baseURL: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  compatibility: "compatible",
});

export const mastra = new Mastra({
  agents: { docsAgent },
  vectors: {
    default: new LibSQLVector({
      connectionUrl: process.env.VECTOR_DB_URL || "file:./vector.db",
    }),
  },
});

export { customOpenAI };
