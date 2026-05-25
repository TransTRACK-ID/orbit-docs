import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
import { getDb } from "~/server/database";
import { changelogs, appVersions } from "~/server/database/schema";
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

  const rows = await db
    .select({
      id: changelogs.id,
      appId: changelogs.appId,
      versionId: changelogs.versionId,
      title: changelogs.title,
      content: changelogs.content,
      status: changelogs.status,
      createdBy: changelogs.createdBy,
      createdAt: changelogs.createdAt,
      updatedAt: changelogs.updatedAt,
      version: appVersions.version,
    })
    .from(changelogs)
    .leftJoin(appVersions, eq(changelogs.versionId, appVersions.id))
    .where(eq(changelogs.appId, id))
    .orderBy(desc(changelogs.updatedAt))
    .limit(limit);

  return { data: rows };
});
