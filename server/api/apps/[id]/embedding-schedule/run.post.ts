import { defineEventHandler, createError, getRouterParam, setResponseStatus } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { getDocEmbeddingSchedulePublic, startEmbeddingIndexRun } from "~/server/lib/doc-embedding-schedule";
import { isEmbeddingConfigured, isSemanticSearchEnabled } from "~/server/lib/doc-embeddings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const appId = getRouterParam(event, "id");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const db = getDb();
  const app = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  if (!isSemanticSearchEnabled() || !isEmbeddingConfigured()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Semantic search is disabled or no embedding API key is configured",
    });
  }

  // A full run can take far longer than any proxy timeout, so it runs in the
  // background; clients poll GET /embedding-schedule until it leaves "running".
  const run = await startEmbeddingIndexRun(appId);
  if (!run) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "A semantic index run is already in progress for this app",
    });
  }

  setResponseStatus(event, 202);
  return { data: await getDocEmbeddingSchedulePublic(appId) };
});
