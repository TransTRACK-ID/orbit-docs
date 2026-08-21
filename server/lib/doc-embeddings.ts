import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, pool } from "~/server/database";
import { docs } from "~/server/database/schema";
import { docChunks } from "~/server/database/schema/doc-chunks";
import {
  chunkMarkdownForEmbedding,
  INDEXABLE_DOC_TYPES,
  isIndexableDocType,
  type IndexableDocType,
} from "~/server/lib/doc-chunking";
import { getCustomOpenAI } from "~/server/lib/openai";

const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 64;

export function isSemanticSearchEnabled(): boolean {
  return (process.env.SEMANTIC_SEARCH ?? "true").toLowerCase() !== "false";
}

export function isEmbedOnSaveEnabled(): boolean {
  return (process.env.EMBED_ON_SAVE ?? "true").toLowerCase() !== "false";
}

export function hasEmbeddingApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getEmbeddingModelName(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function formatVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasEmbeddingApiKey()) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  const model = getCustomOpenAI().embedding(getEmbeddingModelName());
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

export async function deleteDocChunks(docId: string): Promise<void> {
  const db = getDb();
  await db.delete(docChunks).where(eq(docChunks.docId, docId));
}

export interface IndexDocChunksResult {
  indexed: number;
  skipped: boolean;
  reason?: string;
}

export async function indexDocChunks(docId: string): Promise<IndexDocChunksResult> {
  const db = getDb();
  const row = await db
    .select({
      id: docs.id,
      appId: docs.appId,
      docType: docs.docType,
      status: docs.status,
      content: docs.content,
    })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    return { indexed: 0, skipped: true, reason: "doc_not_found" };
  }

  if (!isIndexableDocType(row.docType)) {
    await deleteDocChunks(docId);
    return { indexed: 0, skipped: true, reason: "doc_type_not_indexable" };
  }

  if (row.status === "archived") {
    await deleteDocChunks(docId);
    return { indexed: 0, skipped: true, reason: "doc_archived" };
  }

  const content = row.content?.trim() || "";
  if (!content) {
    await deleteDocChunks(docId);
    return { indexed: 0, skipped: true, reason: "empty_content" };
  }

  if (!hasEmbeddingApiKey()) {
    return { indexed: 0, skipped: true, reason: "missing_api_key" };
  }

  const chunks = chunkMarkdownForEmbedding(content, row.docType);
  if (chunks.length === 0) {
    await deleteDocChunks(docId);
    return { indexed: 0, skipped: true, reason: "no_chunks" };
  }

  const embeddings = await embedTexts(chunks.map((c) => c.content));
  if (embeddings.some((e) => e.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(`Unexpected embedding dimensions (expected ${EMBEDDING_DIMENSIONS})`);
  }

  await deleteDocChunks(docId);

  const now = new Date();
  const insertValues = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    docId: row.id,
    appId: row.appId,
    docType: row.docType,
    heading: chunk.heading,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    contentHash: contentHash(chunk.content),
    createdAt: now,
    updatedAt: now,
    embedding: embeddings[i]!,
  }));

  for (const value of insertValues) {
    await pool.query(
      `INSERT INTO doc_chunks (
        id, doc_id, app_id, doc_type, heading, chunk_index, content, content_hash, embedding, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10, $11)`,
      [
        value.id,
        value.docId,
        value.appId,
        value.docType,
        value.heading,
        value.chunkIndex,
        value.content,
        value.contentHash,
        formatVector(value.embedding),
        value.createdAt,
        value.updatedAt,
      ],
    );
  }

  return { indexed: insertValues.length, skipped: false };
}

const pendingDocIds = new Set<string>();

export function scheduleDocEmbedding(docId: string): void {
  if (!isEmbedOnSaveEnabled() || !isSemanticSearchEnabled()) return;
  if (pendingDocIds.has(docId)) return;

  pendingDocIds.add(docId);
  void indexDocChunks(docId)
    .then((result) => {
      if (result.skipped && result.reason === "missing_api_key") {
        return;
      }
      if (!result.skipped) {
        console.log(`[doc-embed] indexed ${result.indexed} chunks for doc ${docId}`);
      }
    })
    .catch((err) => {
      console.error(`[doc-embed] failed for doc ${docId}:`, err);
    })
    .finally(() => {
      pendingDocIds.delete(docId);
    });
}

export type DocEmbeddingStatus =
  | "not_indexable"
  | "no_api_key"
  | "pending"
  | "indexed"
  | "stale";

export interface DocEmbeddingStatusResult {
  status: DocEmbeddingStatus;
  chunkCount: number;
  lastIndexedAt: string | null;
  indexable: boolean;
}

export async function getDocEmbeddingStatus(docId: string): Promise<DocEmbeddingStatusResult> {
  const db = getDb();
  const row = await db
    .select({
      id: docs.id,
      docType: docs.docType,
      content: docs.content,
    })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    return {
      status: "not_indexable",
      chunkCount: 0,
      lastIndexedAt: null,
      indexable: false,
    };
  }

  if (!isIndexableDocType(row.docType)) {
    return {
      status: "not_indexable",
      chunkCount: 0,
      lastIndexedAt: null,
      indexable: false,
    };
  }

  if (!hasEmbeddingApiKey()) {
    return {
      status: "no_api_key",
      chunkCount: 0,
      lastIndexedAt: null,
      indexable: true,
    };
  }

  const stored = await db
    .select({
      contentHash: docChunks.contentHash,
      updatedAt: docChunks.updatedAt,
    })
    .from(docChunks)
    .where(eq(docChunks.docId, docId))
    .orderBy(docChunks.chunkIndex);

  if (stored.length === 0) {
    return {
      status: "pending",
      chunkCount: 0,
      lastIndexedAt: null,
      indexable: true,
    };
  }

  const expected = chunkMarkdownForEmbedding(row.content || "", row.docType);
  const expectedHashes = expected.map((chunk) => contentHash(chunk.content)).sort();
  const storedHashes = stored.map((chunk) => chunk.contentHash).sort();

  const hashesMatch =
    expectedHashes.length === storedHashes.length &&
    expectedHashes.every((hash, index) => hash === storedHashes[index]);

  const lastIndexedAt = stored.reduce<Date | null>((latest, chunk) => {
    if (!chunk.updatedAt) return latest;
    if (!latest || chunk.updatedAt > latest) return chunk.updatedAt;
    return latest;
  }, null);

  return {
    status: hashesMatch ? "indexed" : "stale",
    chunkCount: stored.length,
    lastIndexedAt: lastIndexedAt?.toISOString() ?? null,
    indexable: true,
  };
}

function chunkHashesForDoc(content: string, docType: string | null): string[] {
  return chunkMarkdownForEmbedding(content, docType)
    .map((chunk) => contentHash(chunk.content))
    .sort();
}

function matchesStoredChunkHashes(
  content: string,
  docType: string | null,
  storedHashes: string[],
): boolean {
  if (storedHashes.length === 0) return false;
  const expectedHashes = chunkHashesForDoc(content, docType);
  const sortedStored = [...storedHashes].sort();
  return (
    expectedHashes.length === sortedStored.length &&
    expectedHashes.every((hash, index) => hash === sortedStored[index])
  );
}

export interface EmbeddingWorkspaceStats {
  semanticSearchEnabled: boolean;
  embedOnSaveEnabled: boolean;
  hasApiKey: boolean;
  embeddingModel: string;
  indexableDocs: number;
  indexedDocs: number;
  pendingDocs: number;
  staleDocs: number;
  totalChunks: number;
  byDocType: Record<IndexableDocType, { indexable: number; indexed: number; pending: number; stale: number }>;
}

export async function getEmbeddingWorkspaceStats(params?: {
  appId?: string;
}): Promise<EmbeddingWorkspaceStats> {
  const db = getDb();
  const docConditions = [
    inArray(docs.docType, [...INDEXABLE_DOC_TYPES]),
    ne(docs.status, "archived"),
  ];

  if (params?.appId) {
    docConditions.push(eq(docs.appId, params.appId));
  }

  const indexableRows = await db
    .select({
      id: docs.id,
      docType: docs.docType,
      content: docs.content,
    })
    .from(docs)
    .where(and(...docConditions));

  const chunkConditions = [inArray(docs.docType, [...INDEXABLE_DOC_TYPES]), ne(docs.status, "archived")];
  if (params?.appId) {
    chunkConditions.push(eq(docChunks.appId, params.appId));
  }

  const chunkRows = await db
    .select({
      docId: docChunks.docId,
      contentHash: docChunks.contentHash,
    })
    .from(docChunks)
    .innerJoin(docs, eq(docs.id, docChunks.docId))
    .where(and(...chunkConditions));

  const hashesByDoc = new Map<string, string[]>();
  for (const row of chunkRows) {
    const list = hashesByDoc.get(row.docId) ?? [];
    list.push(row.contentHash);
    hashesByDoc.set(row.docId, list);
  }

  const byDocType = Object.fromEntries(
    INDEXABLE_DOC_TYPES.map((type) => [type, { indexable: 0, indexed: 0, pending: 0, stale: 0 }]),
  ) as EmbeddingWorkspaceStats["byDocType"];

  let indexedDocs = 0;
  let pendingDocs = 0;
  let staleDocs = 0;

  for (const row of indexableRows) {
    const docType = row.docType as IndexableDocType;
    if (!isIndexableDocType(docType)) continue;

    byDocType[docType].indexable += 1;
    const storedHashes = hashesByDoc.get(row.id) ?? [];

    if (storedHashes.length === 0) {
      pendingDocs += 1;
      byDocType[docType].pending += 1;
      continue;
    }

    if (matchesStoredChunkHashes(row.content || "", docType, storedHashes)) {
      indexedDocs += 1;
      byDocType[docType].indexed += 1;
    } else {
      staleDocs += 1;
      byDocType[docType].stale += 1;
    }
  }

  const totalChunksResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(docChunks)
    .innerJoin(docs, eq(docs.id, docChunks.docId))
    .where(and(...chunkConditions));

  return {
    semanticSearchEnabled: isSemanticSearchEnabled(),
    embedOnSaveEnabled: isEmbedOnSaveEnabled(),
    hasApiKey: hasEmbeddingApiKey(),
    embeddingModel: getEmbeddingModelName(),
    indexableDocs: indexableRows.length,
    indexedDocs,
    pendingDocs,
    staleDocs,
    totalChunks: totalChunksResult[0]?.count ?? 0,
    byDocType,
  };
}

export interface RebuildDocEmbeddingsOptions {
  appId?: string;
  docTypes?: IndexableDocType[];
  dryRun?: boolean;
}

export interface RebuildDocEmbeddingsResult {
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  preview?: Array<{ id: string; title: string; docType: string | null }>;
}

export async function rebuildDocEmbeddings(
  options: RebuildDocEmbeddingsOptions = {},
): Promise<RebuildDocEmbeddingsResult> {
  const db = getDb();
  const docTypes = options.docTypes?.length ? options.docTypes : [...INDEXABLE_DOC_TYPES];
  const conditions = [inArray(docs.docType, docTypes), ne(docs.status, "archived")];

  if (options.appId) {
    conditions.push(eq(docs.appId, options.appId));
  }

  const rows = await db
    .select({ id: docs.id, title: docs.title, docType: docs.docType })
    .from(docs)
    .where(and(...conditions))
    .orderBy(docs.updatedAt);

  if (options.dryRun) {
    return {
      total: rows.length,
      indexed: 0,
      skipped: 0,
      failed: 0,
      dryRun: true,
      preview: rows.slice(0, 20).map((row) => ({
        id: row.id,
        title: row.title,
        docType: row.docType,
      })),
    };
  }

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await indexDocChunks(row.id);
      if (result.skipped) skipped += 1;
      else indexed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    total: rows.length,
    indexed,
    skipped,
    failed,
    dryRun: false,
  };
}

export function getEmbeddingConfig() {
  return {
    semanticSearchEnabled: isSemanticSearchEnabled(),
    embedOnSaveEnabled: isEmbedOnSaveEnabled(),
    hasApiKey: hasEmbeddingApiKey(),
    embeddingModel: getEmbeddingModelName(),
  };
}

export interface ReindexPendingAndStaleResult {
  candidates: number;
  indexed: number;
  skipped: number;
  failed: number;
}

/** Index only docs that are pending or stale (efficient scheduled catch-up). */
export async function reindexPendingAndStaleDocEmbeddings(
  appId: string,
): Promise<ReindexPendingAndStaleResult> {
  if (!isSemanticSearchEnabled() || !hasEmbeddingApiKey()) {
    return { candidates: 0, indexed: 0, skipped: 0, failed: 0 };
  }

  const db = getDb();
  const rows = await db
    .select({ id: docs.id })
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        inArray(docs.docType, [...INDEXABLE_DOC_TYPES]),
        ne(docs.status, "archived"),
      ),
    );

  let candidates = 0;
  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const status = await getDocEmbeddingStatus(row.id);
    if (status.status !== "pending" && status.status !== "stale") {
      skipped += 1;
      continue;
    }

    candidates += 1;
    try {
      const result = await indexDocChunks(row.id);
      if (result.skipped) skipped += 1;
      else indexed += 1;
    } catch {
      failed += 1;
    }
  }

  return { candidates, indexed, skipped, failed };
}
