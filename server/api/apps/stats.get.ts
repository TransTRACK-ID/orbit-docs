import { defineEventHandler } from "h3";
import { getDb } from "~/server/database";
import { apps, appVersions } from "~/server/database/schema";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  const activeAppsResult = await db
    .select({ count: count() })
    .from(apps)
    .where(eq(apps.status, "active"));

  const totalVersionsResult = await db
    .select({ count: count() })
    .from(appVersions);

  const publishedDocsResult = await db
    .select({ count: count() })
    .from(appVersions)
    .where(eq(appVersions.status, "published"));

  const draftVersionsResult = await db
    .select({ count: count() })
    .from(appVersions)
    .where(eq(appVersions.status, "draft"));

  return {
    data: {
      activeApps: activeAppsResult[0]?.count ?? 0,
      totalVersions: totalVersionsResult[0]?.count ?? 0,
      publishedDocs: publishedDocsResult[0]?.count ?? 0,
      draftVersions: draftVersionsResult[0]?.count ?? 0,
    },
  };
});
