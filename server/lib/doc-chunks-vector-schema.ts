import type { Pool } from "pg";
import { getEmbeddingDimensions, parseVectorTypeDimensions } from "~/server/lib/doc-embeddings";

export async function isDocChunksEmbeddingColumnPresent(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ present: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'doc_chunks'::regclass
        AND attname = 'embedding'
        AND NOT attisdropped
    ) AS present
  `);
  return result.rows[0]?.present === true;
}

/**
 * Ensures pgvector is enabled and `doc_chunks.embedding` exists with the
 * configured dimensions. Safe to call repeatedly (boot, before indexing).
 * Returns false when the database server lacks pgvector.
 */
export async function ensureDocChunksVectorSchema(pool: Pool): Promise<boolean> {
  const embeddingDimensions = getEmbeddingDimensions();
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  } catch (err) {
    console.error(
      "[doc-chunks-schema] pgvector unavailable — semantic indexing requires the vector extension on the database server:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  try {
    await pool.query(
      `ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS embedding vector(${embeddingDimensions})`,
    );
  } catch (err) {
    console.error(
      "[doc-chunks-schema] could not add doc_chunks.embedding:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  const embeddingColumn = await pool.query<{ type: string }>(`
    SELECT format_type(atttypid, atttypmod) AS type
    FROM pg_attribute
    WHERE attrelid = 'doc_chunks'::regclass AND attname = 'embedding' AND NOT attisdropped
  `);
  const currentDimensions = parseVectorTypeDimensions(embeddingColumn.rows[0]?.type);
  if (currentDimensions !== null && currentDimensions !== embeddingDimensions) {
    console.warn(
      `[doc-chunks-schema] doc_chunks.embedding is vector(${currentDimensions}), expected vector(${embeddingDimensions}); clearing chunks for re-embedding`,
    );
    await pool.query(`DROP INDEX IF EXISTS doc_chunks_embedding_hnsw_idx`);
    await pool.query(`DELETE FROM doc_chunks`);
    await pool.query(
      `ALTER TABLE doc_chunks ALTER COLUMN embedding TYPE vector(${embeddingDimensions})`,
    );
  }

  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS doc_chunks_embedding_hnsw_idx
      ON doc_chunks USING hnsw (embedding vector_cosine_ops)
    `);
  } catch (err) {
    console.warn("[doc-chunks-schema] doc_chunks HNSW index skipped:", err instanceof Error ? err.message : err);
  }

  return isDocChunksEmbeddingColumnPresent(pool);
}

export const DOC_CHUNKS_EMBEDDING_SCHEMA_ERROR =
  'doc_chunks.embedding is missing — install the pgvector extension on PostgreSQL and restart Orbit Docs (db-init will add the column on boot)';

export function isDocChunksEmbeddingSchemaError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "42703" || code === "42704") return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('column "embedding" of relation "doc_chunks"') ||
    message.includes('type "vector" does not exist')
  );
}