import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, apps, docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site ID is required" });
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
      openapiSpec: docSites.openapiSpec,
      openapiFormat: docSites.openapiFormat,
      openapiNormalized: docSites.openapiNormalized,
      createdAt: docSites.createdAt,
      updatedAt: docSites.updatedAt,
      appName: apps.name,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(eq(docSites.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  const pageRows = await db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
      status: docs.status,
      sortOrder: docs.sortOrder,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(eq(docs.siteId, id))
    .orderBy(docs.sortOrder, docs.updatedAt);

  return {
    data: {
      id: row.id,
      appId: row.appId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      navConfig: row.navConfig,
      openapiSpec: row.openapiSpec,
      openapiFormat: row.openapiFormat,
      openapiNormalized: row.openapiNormalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      app: row.appName ? { id: row.appId, name: row.appName } : null,
      pages: pageRows,
    },
  };
});
