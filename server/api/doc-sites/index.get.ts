import { defineEventHandler, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, apps } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);
  const appId = typeof query.appId === "string" ? query.appId : "";

  const rows = await db
    .select({
      id: docSites.id,
      appId: docSites.appId,
      name: docSites.name,
      slug: docSites.slug,
      description: docSites.description,
      status: docSites.status,
      navConfig: docSites.navConfig,
      createdAt: docSites.createdAt,
      updatedAt: docSites.updatedAt,
      appName: apps.name,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(appId ? eq(docSites.appId, appId) : undefined)
    .orderBy(docSites.createdAt);

  const data = rows.map((row) => ({
    id: row.id,
    appId: row.appId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    navConfig: row.navConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName ? { id: row.appId, name: row.appName } : null,
  }));

  return { data };
});
