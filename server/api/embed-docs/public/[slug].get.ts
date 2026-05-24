import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, apps, appVersions, workspaceSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Slug is required",
    });
  }

  // Check public access setting
  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const settings = settingsRows[0];
  const publicAccess = settings ? settings.publicDocsAccess : true;

  if (!publicAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Public docs access is disabled",
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
    .where(eq(docEmbeds.slug, slug))
    .limit(1);

  const doc = rows[0] || null;

  if (!doc || doc.status !== "published") {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Embed doc not found",
    });
  }

  return {
    data: {
      id: doc.id,
      appId: doc.appId,
      versionId: doc.versionId,
      title: doc.title,
      slug: doc.slug,
      subtitle: doc.subtitle,
      navItems: doc.navItems,
      content: doc.content,
      status: doc.status,
      author: doc.author,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      app: doc.appName ? { id: doc.appId, name: doc.appName } : null,
      version: doc.version ? { id: doc.versionId, version: doc.version } : null,
    },
  };
});
