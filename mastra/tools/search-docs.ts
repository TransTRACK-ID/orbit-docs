import { createTool } from "@mastra/core";
import { z } from "zod";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { and, eq, sql } from "drizzle-orm";

export const searchDocsTool = createTool({
  id: "search-docs",
  description: "Search through documentation for relevant content based on a query",
  inputSchema: z.object({
    query: z.string().describe("The search query to find relevant documentation"),
    docId: z.string().optional().describe("Optional specific document ID to search within"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        relevance: z.number(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const db = getDb();
    const { query, docId } = context;

    const searchPattern = `%${query}%`;

    let conditions = [sql`${docs.content} ILIKE ${searchPattern}`];
    if (docId) {
      conditions.push(eq(docs.id, docId));
    }

    const rows = await db
      .select({
        id: docs.id,
        title: docs.title,
        content: docs.content,
      })
      .from(docs)
      .where(and(...conditions))
      .limit(5);

    return {
      results: rows.map((row) => ({
        ...row,
        relevance: 1.0,
      })),
    };
  },
});
