import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, pool } from "~/server/database";
import { docs } from "~/server/database/schema";
import { docChunks } from "~/server/database/schema/doc-chunks";
import { INDEXABLE_DOC_TYPES } from "~/server/lib/doc-chunking";
import {
  embedTexts,
  hasEmbeddingApiKey,
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

function buildDocFilters(params: {
  appId: string;
  docTypes?: string[];
  publishedOnly?: boolean;
}): SQL[] {
  const conditions: SQL[] = [eq(docChunks.appId, params.appId)];

  const docTypes =
    params.docTypes?.length && params.docTypes.length > 0
      ? params.docTypes.filter((t) => INDEXABLE_DOC_TYPES.includes(t as (typeof INDEXABLE_DOC_TYPES)[number]))
      : [...INDEXABLE_DOC_TYPES];

  if (docTypes.length > 0) {
    conditions.push(inArray(docChunks.docType, docTypes));
  }

  if (params.publishedOnly) {
    conditions.push(eq(docs.status, "published"));
  }

  return conditions;
}

async function keywordChunkSearch(params: {
  appId: string;
  query: string;
  docTypes?: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const query = params.query.trim();
  if (!query) return [];

  const db = getDb();
  const pattern = `%${query}%`;
  const filters = buildDocFilters(params);

  const rows = await db
    .select({ id: docChunks.id })
    .from(docChunks)
    .innerJoin(docs, eq(docs.id, docChunks.docId))
    .where(
      and(
        ...filters,
        sql`(
          ${docChunks.content} ILIKE ${pattern}
          OR ${docChunks.heading} ILIKE ${pattern}
          OR ${docs.title} ILIKE ${pattern}
        )`,
      ),
    )
    .limit(params.limit);

  return rows.map((row) => ({ id: row.id }));
}

async function vectorChunkSearch(params: {
  appId: string;
  queryEmbedding: number[];
  docTypes?: string[];
  publishedOnly?: boolean;
  limit: number;
}): Promise<Array<{ id: string }>> {
  const vectorLiteral = `[${params.queryEmbedding.join(",")}]`;
  const docTypes =
    params.docTypes?.length && params.docTypes.length > 0
      ? params.docTypes.filter((t) => INDEXABLE_DOC_TYPES.includes(t as (typeof INDEXABLE_DOC_TYPES)[number]))
      : [...INDEXABLE_DOC_TYPES];

  const statusClause = params.publishedOnly ? `AND d.status = 'published'` : "";
  const docTypeClause =
    docTypes.length > 0
      ? `AND dc.doc_type = ANY($3::text[])`
      : `AND dc.doc_type = ANY($3::text[])`;

  const values: unknown[] = [params.appId, vectorLiteral, docTypes, params.limit];
  const result = await pool.query<{ id: string }>(
    `
      SELECT dc.id
      FROM doc_chunks dc
      INNER JOIN docs d ON d.id = dc.doc_id
      WHERE dc.app_id = $1
        AND dc.embedding IS NOT NULL
        ${docTypeClause}
        ${statusClause}
      ORDER BY dc.embedding <=> $2::vector
      LIMIT $4
    `,
    values,
  );

  return result.rows.map((row) => ({ id: row.id }));
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
    })
    .from(docChunks)
    .innerJoin(docs, eq(docs.id, docChunks.docId))
    .where(inArray(docChunks.id, ids));

  const byId = new Map(rows.map((row) => [row.chunkId, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      chunkId: row.chunkId,
      docId: row.docId,
      title: row.title,
      docType: row.docType,
      heading: row.heading,
      content: row.content,
      score: 0,
    }));
}

export async function searchDocChunksHybrid(params: {
  appId: string;
  query: string;
  docTypes?: string[];
  publishedOnly?: boolean;
  limit?: number;
}): Promise<ChunkSearchResult[]> {
  const limit = params.limit ?? 12;
  const branchLimit = Math.max(limit * 3, 40);
  const query = params.query.trim();
  if (!query) return [];

  const keywordRanked = await keywordChunkSearch({
    ...params,
    limit: branchLimit,
  });

  let vectorRanked: Array<{ id: string }> = [];
  if (isSemanticSearchEnabled() && hasEmbeddingApiKey()) {
    try {
      const [queryEmbedding] = await embedTexts([query]);
      if (queryEmbedding) {
        vectorRanked = await vectorChunkSearch({
          appId: params.appId,
          queryEmbedding,
          docTypes: params.docTypes,
          publishedOnly: params.publishedOnly,
          limit: branchLimit,
        });
      }
    } catch (err) {
      console.error("[doc-chunk-search] vector branch failed:", err);
    }
  }

  if (keywordRanked.length === 0 && vectorRanked.length === 0) {
    return [];
  }

  if (vectorRanked.length === 0) {
    const keywordOnly = await loadChunksByIds(keywordRanked.slice(0, limit).map((r) => r.id));
    return keywordOnly;
  }

  if (keywordRanked.length === 0) {
    const vectorOnly = await loadChunksByIds(vectorRanked.slice(0, limit).map((r) => r.id));
    return vectorOnly;
  }

  const fused = reciprocalRankFusion([keywordRanked, vectorRanked], getRrfK());
  const sortedIds = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const loaded = await loadChunksByIds(sortedIds);
  return loaded.map((row) => ({
    ...row,
    score: fused.get(row.chunkId) ?? 0,
  }));
}
