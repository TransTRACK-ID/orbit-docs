import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { isBindingAdrDoc } from "~/server/lib/adr-queries";
import { docCategoryCondition } from "~/server/lib/mcp-doc-queries";

export interface DocContentSearchResult {
  id: string;
  title: string;
  content: string | null;
  docType: string | null;
  status: string;
  externalId: string | null;
  frontmatter?: Record<string, unknown> | null;
  binding?: boolean;
}

export async function searchDocsContent(params: {
  appId?: string;
  query: string;
  docTypes?: string[];
  category?: "product" | "knowledge";
  publishedOnly?: boolean;
  limit?: number;
}): Promise<{ results: DocContentSearchResult[]; total: number }> {
  const db = getDb();
  const limit = params.limit ?? 10;
  const query = params.query.trim();
  const conditions: SQL[] = [];

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      sql`(
        ${docs.content} ILIKE ${pattern}
        OR ${docs.title} ILIKE ${pattern}
        OR ${docs.externalId} ILIKE ${pattern}
      )`,
    );
  }

  if (params.appId) {
    conditions.push(eq(docs.appId, params.appId));
  }

  if (params.publishedOnly) {
    conditions.push(eq(docs.status, "published"));
  }

  if (params.docTypes?.length) {
    conditions.push(inArray(docs.docType, params.docTypes));
  }

  const categoryCondition = docCategoryCondition(params.category);
  if (categoryCondition) {
    conditions.push(categoryCondition);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      content: docs.content,
      docType: docs.docType,
      status: docs.status,
      externalId: docs.externalId,
      frontmatter: docs.frontmatter,
    })
    .from(docs)
    .where(whereClause)
    .limit(Math.max(limit * 3, limit));

  const mapped = rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    docType: row.docType,
    status: row.status,
    externalId: row.externalId,
    frontmatter: row.frontmatter ?? null,
    binding: isBindingAdrDoc({
      docType: row.docType,
      status: row.status,
      frontmatter: row.frontmatter ?? null,
    }),
  }));

  mapped.sort((a, b) => {
    if (a.binding && !b.binding) return -1;
    if (!a.binding && b.binding) return 1;
    return 0;
  });

  const results = mapped.slice(0, limit);

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(docs)
    .where(whereClause);

  return {
    results,
    total: totalResult[0]?.count ?? results.length,
  };
}
