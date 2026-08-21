import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { getDocEmbeddingSchedulePublic } from "~/server/lib/doc-embedding-schedule";

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

  return { data: await getDocEmbeddingSchedulePublic(appId) };
});
