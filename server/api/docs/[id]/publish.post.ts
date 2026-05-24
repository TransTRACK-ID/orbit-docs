import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, activityLogs, apps, appVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  const updatedRow = await db
    .update(docs)
    .set({ status: "published" })
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  // Fetch joined data to return consistent shape
  const enrichedRows = await db
    .select({
      id: docs.id,
      appId: docs.appId,
      title: docs.title,
      content: docs.content,
      status: docs.status,
      versionId: docs.versionId,
      tags: docs.tags,
      author: docs.author,
      createdAt: docs.createdAt,
      updatedAt: docs.updatedAt,
      appName: apps.name,
      version: appVersions.version,
    })
    .from(docs)
    .leftJoin(apps, eq(docs.appId, apps.id))
    .leftJoin(appVersions, eq(docs.versionId, appVersions.id))
    .where(eq(docs.id, id))
    .limit(1);

  const enriched = enrichedRows[0];

  const allVersions = enriched.appId
    ? await db
        .select({ id: appVersions.id, version: appVersions.version, status: appVersions.status })
        .from(appVersions)
        .where(eq(appVersions.appId, enriched.appId))
        .orderBy(desc(appVersions.createdAt))
    : [];

  await db.insert(activityLogs).values({
    appId: updatedRow.appId,
    appName: updatedRow.title,
    action: "Doc published",
    actor: updatedRow.author || getActorName(user),
  });

  return {
    data: {
      ...updatedRow,
      app: enriched.appName ? { id: enriched.appId, name: enriched.appName } : null,
      version: enriched.version ? { id: enriched.versionId, version: enriched.version } : null,
      appVersions: allVersions,
    },
  };
});
