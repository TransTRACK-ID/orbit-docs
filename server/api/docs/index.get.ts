import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions, docSites } from "~/server/database/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";
  const appId = typeof query.appId === "string" ? query.appId : "";
  const status = typeof query.status === "string" ? query.status : "";

  const conditions = [];
  if (search) {
    conditions.push(sql`${docs.title} ILIKE ${"%" + search + "%"}`);
  }
  if (appId) {
    conditions.push(eq(docs.appId, appId));
  }
  if (status) {
    conditions.push(eq(docs.status, status as "draft" | "in_review" | "published" | "archived"));
  }
  const siteId = typeof query.siteId === "string" ? query.siteId : "";
  if (siteId) {
    conditions.push(eq(docs.siteId, siteId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      externalId: docs.externalId,
      siteId: docs.siteId,
      slug: docs.slug,
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
    .where(whereClause)
    .orderBy(desc(docs.updatedAt));

  const data = rows.map((row) => ({
    id: row.id,
    appId: row.appId,
    title: row.title,
    content: row.content,
    status: row.status,
    versionId: row.versionId,
    tags: row.tags,
    author: row.author,
    source: row.source,
    docType: row.docType,
    externalId: row.externalId,
    siteId: row.siteId,
    slug: row.slug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName ? { id: row.appId, name: row.appName } : null,
    version: row.version ? { id: row.versionId, version: row.version } : null,
    site: row.siteId ? { id: row.siteId, name: row.siteName, slug: row.siteSlug } : null,
  }));

  return { data };
});
