import { defineEventHandler, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions, workspaceSettings } from "~/server/database/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";
  const appId = typeof query.appId === "string" ? query.appId : "";

  // Check workspace public docs access setting
  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const settings = settingsRows[0];
  const isPublic = settings?.publicDocsAccess ?? true;

  if (!isPublic) {
    await requireAuth(event);
  }

  const conditions = [eq(docs.status, "published")];
  if (search) {
    conditions.push(sql`${docs.title} ILIKE ${"%" + search + "%"}`);
  }
  if (appId) {
    conditions.push(eq(docs.appId, appId));
  }

  const whereClause = and(...conditions);

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName ? { id: row.appId, name: row.appName } : null,
    version: row.version ? { id: row.versionId, version: row.version } : null,
  }));

  return { data };
});
