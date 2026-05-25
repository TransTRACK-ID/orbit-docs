import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
import { getDb } from "~/server/database";
import { appVersions, releases } from "~/server/database/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  // Query 1: fetch versions for the app
  const versions = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.appId, id))
    .orderBy(desc(appVersions.createdAt))
    .limit(limit);

  // Query 2: fetch all releases for this app
  const releaseRows = await db
    .select({
      versionId: releases.versionId,
      id: releases.id,
      type: releases.type,
      published: releases.published,
    })
    .from(releases)
    .where(eq(releases.appId, id));

  // Group releases by version
  const releasesByVersion = new Map<string, Array<{ id: string; type: string; published: boolean }>>();
  for (const r of releaseRows) {
    const list = releasesByVersion.get(r.versionId) || [];
    list.push({ id: r.id, type: r.type, published: r.published });
    releasesByVersion.set(r.versionId, list);
  }

  const data = versions.map((v) => ({
    ...v,
    releases: releasesByVersion.get(v.id) || [],
    releasePublished: releasesByVersion.get(v.id)?.some((r) => r.published) || false,
  }));

  return { data };
});
