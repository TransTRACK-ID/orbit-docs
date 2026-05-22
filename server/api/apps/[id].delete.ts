import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { apps, appVersions, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const existing = await db
    .select()
    .from(apps)
    .where(eq(apps.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  await db.delete(appVersions).where(eq(appVersions.appId, id));
  await db.delete(apps).where(eq(apps.id, id));

  return { data: { id, deleted: true } };
});
