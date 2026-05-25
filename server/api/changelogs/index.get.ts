import { defineEventHandler, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { changelogs, apps, appVersions } from "~/server/database/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);

  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const appFilter = typeof query.app === "string" ? query.app : "";
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  const conditions = [];
  if (appFilter) {
    conditions.push(eq(apps.id, appFilter));
  }

  const rows = await db
    .select({
      id: changelogs.id,
      appId: changelogs.appId,
      versionId: changelogs.versionId,
      content: changelogs.content,
      status: changelogs.status,
      author: changelogs.author,
      createdAt: changelogs.createdAt,
      updatedAt: changelogs.updatedAt,
      appName: apps.name,
      version: appVersions.version,
      releaseDate: appVersions.releaseDate,
    })
    .from(changelogs)
    .innerJoin(apps, eq(changelogs.appId, apps.id))
    .leftJoin(appVersions, eq(changelogs.versionId, appVersions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(changelogs.updatedAt))
    .limit(limit);

  let result = rows;
  if (search) {
    result = rows.filter((r) => {
      const haystack = [
        r.appName,
        r.version,
        r.content,
        r.author,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return { data: result };
});
