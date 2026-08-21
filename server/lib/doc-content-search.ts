import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { isBindingAdrDoc } from "~/server/lib/adr-queries";
import { searchDocChunksHybrid } from "~/server/lib/doc-chunk-search";
import {
  indexableDocTypesForCategory,
  isIndexableDocType,
} from "~/server/lib/doc-chunking";
import {
  hasEmbeddingApiKey,
  isSemanticSearchEnabled,
} from "~/server/lib/doc-embeddings";
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
  heading?: string;
  chunkId?: string;
  score?: number;
}

export type DocContentSearchMode = "hybrid" | "keyword";

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

export async function searchDocsContentHybrid(params: {
  appId?: string;
  query: string;
  docTypes?: string[];
  category?: "product" | "knowledge";
  publishedOnly?: boolean;
  limit?: number;
}): Promise<{
  results: DocContentSearchResult[];
  total: number;
  searchMode: DocContentSearchMode;
}> {
  const limit = params.limit ?? 10;
  const query = params.query.trim();

  if (
    !query ||
    !params.appId ||
    !isSemanticSearchEnabled() ||
    !hasEmbeddingApiKey()
  ) {
    const legacy = await searchDocsContent(params);
    return { ...legacy, searchMode: "keyword" };
  }

  const indexableTypes = indexableDocTypesForCategory(params.category).filter(
    (type) => !params.docTypes?.length || params.docTypes.includes(type),
  );

  const chunkRows =
    indexableTypes.length > 0
      ? await searchDocChunksHybrid({
          appId: params.appId,
          query,
          docTypes: indexableTypes,
          publishedOnly: params.publishedOnly,
          limit,
        })
      : [];

  const chunkResults: DocContentSearchResult[] = chunkRows.map((row) => ({
    id: row.docId,
    title: `${row.title} › ${row.heading}`,
    content: row.content,
    docType: row.docType,
    status: "published",
    externalId: null,
    heading: row.heading,
    chunkId: row.chunkId,
    score: row.score,
  }));

  const nonIndexableDocTypes = params.docTypes?.filter((type) => !isIndexableDocType(type));

  const keywordSupplement = await searchDocsContent({
    ...params,
    docTypes: nonIndexableDocTypes?.length ? nonIndexableDocTypes : undefined,
    limit: Math.max(limit - chunkResults.length, 0) || limit,
  });

  const filteredKeyword = keywordSupplement.results.filter(
    (row) => !isIndexableDocType(row.docType),
  );

  if (chunkResults.length === 0 && filteredKeyword.length === 0) {
    const fallback = await searchDocsContent(params);
    return { ...fallback, searchMode: "keyword" };
  }

  const merged = [...chunkResults, ...filteredKeyword].slice(0, limit);

  return {
    results: merged,
    total: merged.length,
    searchMode: chunkResults.length > 0 ? "hybrid" : "keyword",
  };
}
