import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { apps, appVersions } from "~/server/database/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const db = getDb();
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";

  const allApps = await db
    .select({
      id: apps.id,
      name: apps.name,
      description: apps.description,
      owner: apps.owner,
      status: apps.status,
      repoUrl: apps.repoUrl,
      createdAt: apps.createdAt,
      updatedAt: apps.updatedAt,
    })
    .from(apps)
    .where(
      search
        ? sql`${apps.name} LIKE ${"%" + search + "%"}`
        : undefined
    )
    .orderBy(desc(apps.updatedAt));

  const appsWithVersions = await Promise.all(
    allApps.map(async (app) => {
      const latestVersion = await db
        .select()
        .from(appVersions)
        .where(eq(appVersions.appId, app.id))
        .orderBy(desc(appVersions.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null);

      return {
        ...app,
        latestVersion: latestVersion
          ? {
              id: latestVersion.id,
              version: latestVersion.version,
              status: latestVersion.status,
              createdBy: latestVersion.createdBy,
            }
          : null,
      };
    })
  );

  return { data: appsWithVersions };
});
