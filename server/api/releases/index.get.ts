import { defineEventHandler, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { releases, apps, appVersions } from "~/server/database/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);

  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const appFilter = typeof query.app === "string" ? query.app : "";
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  // Build conditions
  const conditions = [eq(releases.published, true)];
  if (appFilter) {
    conditions.push(eq(apps.name, appFilter));
  }

  const rows = await db
    .select({
      id: releases.id,
      appId: releases.appId,
      versionId: releases.versionId,
      heroTitle: releases.heroTitle,
      summary: releases.summary,
      features: releases.features,
      categories: releases.categories,
      published: releases.published,
      createdAt: releases.createdAt,
      updatedAt: releases.updatedAt,
      appName: apps.name,
      version: appVersions.version,
      releaseDate: appVersions.releaseDate,
      createdBy: appVersions.createdBy,
      versionStatus: appVersions.status,
    })
    .from(releases)
    .innerJoin(apps, eq(releases.appId, apps.id))
    .innerJoin(appVersions, eq(releases.versionId, appVersions.id))
    .where(and(...conditions))
    .orderBy(desc(appVersions.releaseDate))
    .limit(limit);

  // Post-filter by search text (app name, version, summary, heroTitle)
  let result = rows;
  if (search) {
    result = rows.filter((r) => {
      const haystack = [
        r.appName,
        r.version,
        r.summary,
        r.heroTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return { data: result };
});
