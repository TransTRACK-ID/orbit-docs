import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";

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

  const doc = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!doc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  const app = doc.appId
    ? await db
        .select({ id: apps.id, name: apps.name })
        .from(apps)
        .where(eq(apps.id, doc.appId))
        .limit(1)
        .then((rows) => rows[0] || null)
    : null;

  const version = doc.versionId
    ? await db
        .select({ id: appVersions.id, version: appVersions.version })
        .from(appVersions)
        .where(eq(appVersions.id, doc.versionId))
        .limit(1)
        .then((rows) => rows[0] || null)
    : null;

  const allVersions = doc.appId
    ? await db
        .select({ id: appVersions.id, version: appVersions.version, status: appVersions.status })
        .from(appVersions)
        .where(eq(appVersions.appId, doc.appId))
        .orderBy(eq(appVersions.createdAt))
    : [];

  return {
    data: {
      ...doc,
      app: app ? { id: app.id, name: app.name } : null,
      version: version ? { id: version.id, version: version.version } : null,
      appVersions: allVersions,
    },
  };
});
