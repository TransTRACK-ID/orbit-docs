import { Mastra } from "@mastra/core";
import { LibSQLVector } from "@mastra/libsql";
import { docsAgent } from "./agents/docs-agent";
import { customOpenAI } from "./openai";

export const mastra = new Mastra({
  agents: { docsAgent },
  vectors: {
    default: new LibSQLVector({
      connectionUrl: process.env.VECTOR_DB_URL || "file:./vector.db",
    }),
  },
});

export { customOpenAI };
