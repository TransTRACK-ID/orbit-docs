import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions, docSites } from "~/server/database/schema";
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
      message: "Doc ID is required",
    });
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
      source: docs.source,
      docType: docs.docType,
      siteId: docs.siteId,
      slug: docs.slug,
      frontmatter: docs.frontmatter,
      sortOrder: docs.sortOrder,
      createdAt: docs.createdAt,
      updatedAt: docs.updatedAt,
      appName: apps.name,
      version: appVersions.version,
      siteName: docSites.name,
      siteSlug: docSites.slug,
    })
    .from(docs)
    .leftJoin(apps, eq(docs.appId, apps.id))
    .leftJoin(appVersions, eq(docs.versionId, appVersions.id))
    .leftJoin(docSites, eq(docs.siteId, docSites.id))
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
      site: doc.siteId
        ? { id: doc.siteId, name: doc.siteName, slug: doc.siteSlug }
        : null,
    },
  };
});
