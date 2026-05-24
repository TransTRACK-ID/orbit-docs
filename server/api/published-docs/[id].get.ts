import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions, workspaceSettings } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  // Check workspace public docs access setting
  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const settings = settingsRows[0];
  const isPublic = settings?.publicDocsAccess ?? true;

  if (!isPublic) {
    await requireAuth(event);
  }

  const rows = await db
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

  const doc = rows[0] || null;

  if (!doc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  if (doc.status !== "published") {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "This document is not published",
    });
  }

  const allVersions = doc.appId
    ? await db
        .select({ id: appVersions.id, version: appVersions.version, status: appVersions.status })
        .from(appVersions)
        .where(eq(appVersions.appId, doc.appId))
        .orderBy(desc(appVersions.createdAt))
    : [];

  return {
    data: {
      ...doc,
      app: doc.appName ? { id: doc.appId, name: doc.appName } : null,
      version: doc.version ? { id: doc.versionId, version: doc.version } : null,
      appVersions: allVersions,
    },
  };
});
