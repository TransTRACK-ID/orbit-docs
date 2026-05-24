import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, apps, appVersions } from "~/server/database/schema";
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
    conditions.push(sql`${docEmbeds.title} ILIKE ${"%" + search + "%"}`);
  }
  if (appId) {
    conditions.push(eq(docEmbeds.appId, appId));
  }
  if (status) {
    conditions.push(eq(docEmbeds.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
    .where(whereClause)
    .orderBy(desc(docEmbeds.updatedAt));

  const data = rows.map((row) => ({
    id: row.id,
    appId: row.appId,
    versionId: row.versionId,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    navItems: row.navItems,
    content: row.content,
    status: row.status,
    author: row.author,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName ? { id: row.appId, name: row.appName } : null,
    version: row.version ? { id: row.versionId, version: row.version } : null,
  }));

  return { data };
});
