import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, apps, appVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Embed doc ID is required",
    });
  }

  const rows = await db
    .select({
      id: docEmbeds.id,
      appId: docEmbeds.appId,
      versionId: docEmbeds.versionId,
      title: docEmbeds.title,
      slug: docEmbeds.slug,
      subtitle: docEmbeds.subtitle,
      navItems: docEmbeds.navItems,
      content: docEmbeds.content,
      status: docEmbeds.status,
      author: docEmbeds.author,
      createdAt: docEmbeds.createdAt,
      updatedAt: docEmbeds.updatedAt,
      appName: apps.name,
      version: appVersions.version,
    })
    .from(docEmbeds)
    .leftJoin(apps, eq(docEmbeds.appId, apps.id))
    .leftJoin(appVersions, eq(docEmbeds.versionId, appVersions.id))
    .where(eq(docEmbeds.id, id))
    .limit(1);

  const doc = rows[0] || null;

  if (!doc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Embed doc not found",
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
