import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
import { getDb } from "~/server/database";
import { appVersions } from "~/server/database/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const versions = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.appId, id))
    .orderBy(desc(appVersions.createdAt))
    .limit(limit);

  return { data: versions };
});
