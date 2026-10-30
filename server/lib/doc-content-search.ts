import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs, docSites } from "~/server/database/schema";
import { isBindingAdrDoc } from "~/server/lib/adr-queries";
import { searchDocChunks, type ChunkSearchMode } from "~/server/lib/doc-chunk-search";
import { indexableDocTypesForCategory } from "~/server/lib/doc-chunking";
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
  slug?: string | null;
  siteId?: string | null;
  siteSlug?: string | null;
  siteStatus?: string | null;
  siteName?: string | null;
}

export type DocContentSearchMode = ChunkSearchMode;

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
      slug: docs.slug,
      siteId: docs.siteId,
      siteSlug: docSites.slug,
      siteStatus: docSites.status,
      siteName: docSites.name,
    })
    .from(docs)
    .leftJoin(docSites, eq(docSites.id, docs.siteId))
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
    slug: row.slug,
    siteId: row.siteId,
    siteSlug: row.siteSlug,
    siteStatus: row.siteStatus,
    siteName: row.siteName,
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
  mode?: DocContentSearchMode;
}): Promise<{
  results: DocContentSearchResult[];
  total: number;
  searchMode: DocContentSearchMode;
}> {
  const limit = params.limit ?? 10;
  const query = params.query.trim();

  if (!query || !params.appId) {
    const legacy = await searchDocsContent(params);
    return { ...legacy, searchMode: "keyword" };
  }

  const indexableTypes = indexableDocTypesForCategory(params.category).filter(
    (type) => !params.docTypes?.length || params.docTypes.includes(type),
  );

  const chunkSearch =
    indexableTypes.length > 0
      ? await searchDocChunks({
          appId: params.appId,
          query,
          docTypes: indexableTypes,
          publishedOnly: params.publishedOnly,
          limit,
          mode: params.mode,
        })
      : { results: [], searchMode: "keyword" as const };
  const chunkRows = chunkSearch.results;

  const chunkResults: DocContentSearchResult[] = chunkRows.map((row) => ({
    id: row.docId,
    title: `${row.title} › ${row.heading}`,
    content: row.content,
    docType: row.docType,
    status: row.status,
    slug: row.slug,
    siteId: row.siteId,
    siteSlug: row.siteSlug,
    siteStatus: row.siteStatus,
    siteName: row.siteName,
    externalId: null,
    heading: row.heading,
    chunkId: row.chunkId,
    score: row.score,
  }));

  // Docs not chunked yet (pending embedding) or of other types still surface via doc-level matching.
  const chunkDocIds = new Set(chunkResults.map((row) => row.id));
  const remaining = limit - chunkResults.length;
  const filteredKeyword =
    params.mode === "semantic" || remaining <= 0
      ? []
      : (await searchDocsContent({ ...params, limit: remaining + chunkDocIds.size })).results
          .filter((row) => !chunkDocIds.has(row.id))
          .slice(0, remaining);

  if (chunkResults.length === 0 && filteredKeyword.length === 0) {
    const fallback = await searchDocsContent(params);
    return { ...fallback, searchMode: "keyword" };
  }

  const merged = [...chunkResults, ...filteredKeyword].slice(0, limit);

  return {
    results: merged,
    total: merged.length,
    searchMode: chunkResults.length > 0 ? chunkSearch.searchMode : "keyword",
  };
}
