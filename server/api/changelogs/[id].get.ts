import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { changelogs, apps, appVersions } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Changelog ID is required",
    });
  }

  const rows = await db
    .select({
      id: changelogs.id,
      appId: changelogs.appId,
      versionId: changelogs.versionId,
      content: changelogs.content,
      status: changelogs.status,
      author: changelogs.author,
      createdAt: changelogs.createdAt,
      updatedAt: changelogs.updatedAt,
      appName: apps.name,
      version: appVersions.version,
      releaseDate: appVersions.releaseDate,
    })
    .from(changelogs)
    .innerJoin(apps, eq(changelogs.appId, apps.id))
    .leftJoin(appVersions, eq(changelogs.versionId, appVersions.id))
    .where(eq(changelogs.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Changelog not found",
    });
  }

  return { data: rows[0] };
});
