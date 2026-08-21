import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { isIndexableDocType } from "~/server/lib/doc-chunking";
import {
  getDocEmbeddingStatus,
  indexDocChunks,
} from "~/server/lib/doc-embeddings";
import { requirePermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "docs:write");
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const db = getDb();
  const doc = await db
    .select({ id: docs.id, docType: docs.docType })
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!doc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  if (!isIndexableDocType(doc.docType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc type is not indexed for semantic search",
    });
  }

  const indexResult = await indexDocChunks(id);
  const status = await getDocEmbeddingStatus(id);

  return {
    data: {
      ...indexResult,
      status,
    },
  };
});
