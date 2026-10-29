import { eq, inArray } from "drizzle-orm";
import { getDb, pool } from "~/server/database";
import { docs, docSites } from "~/server/database/schema";
import { docChunks } from "~/server/database/schema/doc-chunks";
import { INDEXABLE_DOC_TYPES } from "~/server/lib/doc-chunking";
import {
  embedTexts,
  isEmbeddingConfigured,
  isSemanticSearchEnabled,
} from "~/server/lib/doc-embeddings";

export interface ChunkSearchResult {
  chunkId: string;
  docId: string;
  title: string;
  docType: string | null;
  heading: string;
  content: string;
  score: number;
  status: string;
  slug: string | null;
  siteId: string | null;
  siteSlug: string | null;
  siteStatus: string | null;
  siteName: string | null;
}

export type ChunkSearchMode = "hybrid" | "keyword" | "semantic";

interface ChunkSearchParams {
  appId: string;
  query: string;
  docTypes?: string[];
  publishedOnly?: boolean;
  limit?: number;
  mode?: ChunkSearchMode;
}

function getRrfK(): number {
  const raw = process.env.HYBRID_SEARCH_RRF_K?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string }>>,
  k: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((item, index) => {
      const rank = index + 1;
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + rank));
    });
  }
  return scores;
}

/** Short queries and single code/ID-like tokens (FEAT-123, user_id, api/v1) need substring matching. */
export function isLiteralLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 3) return true;
  return !/\s/.test(trimmed) && /[-_./:#@]|\d/.test(trimmed);
}

/**
 * Builds a `to_tsquery('simple', ...)` expression that ORs every word so natural-language
 * questions still match; ts_rank_cd ranks chunks covering more words higher.
 * Returns null when the query has no word characters.
 */
export function buildOrTsQuery(query: string): string | null {
  const tokens = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (tokens.length === 0) return null;
  return tokens.map((token) => (token.length >= 4 ? `${token}:*` : token)).join(" | ");
}

function resolveDocTypes(docTypes?: string[]): string[] {
  return docTypes?.length
    ? docTypes.filter((t) => INDEXABLE_DOC_TYPES.includes(t as (typeof INDEXABLE_DOC_TYPES)[number]))
    : [...INDEXABLE_DOC_TYPES];
}

async function fullTextChunkSearch(params: {
  appId: string;
  query: string;
  docTypes: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const usesWebSyntax = /["]|\bOR\b|(^|\s)-\S/.test(params.query);
  const tsQuery = usesWebSyntax ? params.query : buildOrTsQuery(params.query);
  if (!tsQuery) return [];

  const tsQueryFn = usesWebSyntax ? "websearch_to_tsquery" : "to_tsquery";
  const statusClause = params.publishedOnly ? `AND d.status = 'published'` : "";
  const result = await pool.query<{ id: string }>(
    `
      SELECT dc.id
      FROM doc_chunks dc
      INNER JOIN docs d ON d.id = dc.doc_id
      WHERE dc.app_id = $1
        AND dc.doc_type = ANY($2::text[])
        ${statusClause}
        AND dc.search_tsv @@ ${tsQueryFn}('simple', $3)
      ORDER BY ts_rank_cd(dc.search_tsv, ${tsQueryFn}('simple', $3)) DESC
      LIMIT $4
    `,
    [params.appId, params.docTypes, tsQuery, params.limit],
  );
  return result.rows;
}

async function substringChunkSearch(params: {
  appId: string;
  query: string;
  docTypes: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const escaped = params.query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const statusClause = params.publishedOnly ? `AND d.status = 'published'` : "";
  const result = await pool.query<{ id: string }>(
    `
      SELECT dc.id
      FROM doc_chunks dc
      INNER JOIN docs d ON d.id = dc.doc_id
      WHERE dc.app_id = $1
        AND dc.doc_type = ANY($2::text[])
        ${statusClause}
        AND (dc.content ILIKE $3 OR dc.heading ILIKE $3 OR d.title ILIKE $3)
      LIMIT $4
    `,
    [params.appId, params.docTypes, `%${escaped}%`, params.limit],
  );
  return result.rows;
}

async function keywordChunkSearch(params: {
  appId: string;
  query: string;
  docTypes: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const literal = isLiteralLikeQuery(params.query)
    ? await substringChunkSearch(params)
    : [];
  const fullText = await fullTextChunkSearch(params);
  if (literal.length === 0) {
    return fullText.length > 0 ? fullText : substringChunkSearch(params);
  }

  const seen = new Set(literal.map((row) => row.id));
  return [...literal, ...fullText.filter((row) => !seen.has(row.id))].slice(0, params.limit);
}

async function vectorChunkSearch(params: {
  appId: string;
  queryEmbedding: number[];
  docTypes: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const vectorLiteral = `[${params.queryEmbedding.join(",")}]`;
  const statusClause = params.publishedOnly ? `AND d.status = 'published'` : "";
  const result = await pool.query<{ id: string }>(
    `
      SELECT dc.id
      FROM doc_chunks dc
      INNER JOIN docs d ON d.id = dc.doc_id
      WHERE dc.app_id = $1
        AND dc.embedding IS NOT NULL
        AND dc.doc_type = ANY($3::text[])
        ${statusClause}
      ORDER BY dc.embedding <=> $2::vector
      LIMIT $4
    `,
    [params.appId, vectorLiteral, params.docTypes, params.limit],
  );

  return result.rows;
}

async function tryVectorChunkSearch(params: {
  appId: string;
  query: string;
  docTypes: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  if (!isSemanticSearchEnabled() || !isEmbeddingConfigured()) return [];
  try {
    const [queryEmbedding] = await embedTexts([params.query], { purpose: "query" });
    if (!queryEmbedding) return [];
    return await vectorChunkSearch({ ...params, queryEmbedding });
  } catch (err) {
    console.error("[doc-chunk-search] vector branch failed:", err);
    return [];
  }
}

async function loadChunksByIds(ids: string[]): Promise<ChunkSearchResult[]> {
  if (ids.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      chunkId: docChunks.id,
      docId: docChunks.docId,
      title: docs.title,
      docType: docChunks.docType,
      heading: docChunks.heading,
      content: docChunks.content,
      status: docs.status,
      slug: docs.slug,
      siteId: docs.siteId,
      siteSlug: docSites.slug,
      siteStatus: docSites.status,
      siteName: docSites.name,
    })
    .from(docChunks)
    .innerJoin(docs, eq(docs.id, docChunks.docId))
    .leftJoin(docSites, eq(docSites.id, docs.siteId))
    .where(inArray(docChunks.id, ids));

  const byId = new Map(rows.map((row) => [row.chunkId, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({ ...row, score: 0 }));
}

/**
 * Chunk search with an explicit mode. `semantic` and `hybrid` fall back to keyword results
 * when the embedding endpoint is unreachable; `searchMode` reports what actually ran.
 */
export async function searchDocChunks(params: ChunkSearchParams): Promise<{
  results: ChunkSearchResult[];
  searchMode: ChunkSearchMode;
}> {
  const limit = params.limit ?? 12;
  const mode = params.mode ?? "hybrid";
  const query = params.query.trim();
  if (!query) return { results: [], searchMode: "keyword" };

  const branch = {
    appId: params.appId,
    query,
    docTypes: resolveDocTypes(params.docTypes),
    publishedOnly: params.publishedOnly,
    limit: Math.max(limit * 3, 40),
  };
  if (branch.docTypes.length === 0) return { results: [], searchMode: "keyword" };

  const [keywordRanked, vectorRanked] = await Promise.all([
    mode === "semantic" ? Promise.resolve([]) : keywordChunkSearch(branch),
    mode === "keyword" ? Promise.resolve([]) : tryVectorChunkSearch(branch),
  ]);

  if (vectorRanked.length === 0) {
    const keywordOnly =
      mode === "semantic" ? await keywordChunkSearch(branch) : keywordRanked;
    return {
      results: await loadChunksByIds(keywordOnly.slice(0, limit).map((r) => r.id)),
      searchMode: "keyword",
    };
  }

  if (mode === "semantic" || keywordRanked.length === 0) {
    return {
      results: await loadChunksByIds(vectorRanked.slice(0, limit).map((r) => r.id)),
      searchMode: "semantic",
    };
  }

  const fused = reciprocalRankFusion([keywordRanked, vectorRanked], getRrfK());
  const sortedIds = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const loaded = await loadChunksByIds(sortedIds);
  return {
    results: loaded.map((row) => ({ ...row, score: fused.get(row.chunkId) ?? 0 })),
    searchMode: "hybrid",
  };
}

export async function searchDocChunksHybrid(
  params: Omit<ChunkSearchParams, "mode">,
): Promise<ChunkSearchResult[]> {
  const { results } = await searchDocChunks({ ...params, mode: "hybrid" });
  return results;
}
