import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, docs, apps, workspaceSettings } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site slug is required" });
  }

  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const isPublic = settingsRows[0]?.publicDocsAccess ?? true;
  if (!isPublic) {
    await requireAuth(event);
  }

  const rows = await db
    .select({
      id: docSites.id,
      appId: docSites.appId,
      name: docSites.name,
      slug: docSites.slug,
      description: docSites.description,
      status: docSites.status,
      navConfig: docSites.navConfig,
      openapiNormalized: docSites.openapiNormalized,
      updatedAt: docSites.updatedAt,
      appName: apps.name,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(eq(docSites.slug, slug))
    .limit(1);

  const site = rows[0];
  if (!site || site.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  const pageRows = await db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
      status: docs.status,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(and(eq(docs.siteId, site.id), eq(docs.status, "published")));

  return {
    data: {
      id: site.id,
      appId: site.appId,
      name: site.name,
      slug: site.slug,
      description: site.description,
      status: site.status,
      navConfig: site.navConfig,
      openapiNormalized: site.openapiNormalized,
      updatedAt: site.updatedAt,
      app: site.appName ? { id: site.appId, name: site.appName } : null,
      pages: pageRows,
    },
  };
});
