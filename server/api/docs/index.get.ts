import { defineEventHandler, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { docs, apps, appVersions } from "~/server/database/schema";
import { desc, eq, sql, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";
  const appId = typeof query.appId === "string" ? query.appId : "";
  const status = typeof query.status === "string" ? query.status : "";

  const conditions = [];
  if (search) {
    conditions.push(sql`${docs.title} LIKE ${"%" + search + "%"}`);
  }
  if (appId) {
    conditions.push(eq(docs.appId, appId));
  }
  if (status) {
    conditions.push(eq(docs.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allDocs = await db
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
    })
    .from(docs)
    .where(whereClause)
    .orderBy(desc(docs.updatedAt));

  const docsWithRelations = await Promise.all(
    allDocs.map(async (doc) => {
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

      return {
        ...doc,
        app: app ? { id: app.id, name: app.name } : null,
        version: version ? { id: version.id, version: version.version } : null,
      };
    })
  );

  return { data: docsWithRelations };
});
