import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { appVersions, releases, apps } from "~/server/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);
  const appId = typeof query.appId === "string" ? query.appId.trim() : "";
  const limit = Math.min(parseInt(String(query.limit || "100"), 10), 200);

  const versionConditions = appId ? [eq(appVersions.appId, appId)] : [];

  const versions = await db
    .select({
      id: appVersions.id,
      appId: appVersions.appId,
      version: appVersions.version,
      status: appVersions.status,
      createdBy: appVersions.createdBy,
      releaseDate: appVersions.releaseDate,
      releaseNotes: appVersions.releaseNotes,
      branch: appVersions.branch,
      tags: appVersions.tags,
      commitHash: appVersions.commitHash,
      approver: appVersions.approver,
      ciStatus: appVersions.ciStatus,
      createdAt: appVersions.createdAt,
      updatedAt: appVersions.updatedAt,
      appName: apps.name,
    })
    .from(appVersions)
    .innerJoin(apps, eq(appVersions.appId, apps.id))
    .where(versionConditions.length > 0 ? and(...versionConditions) : undefined)
    .orderBy(desc(appVersions.createdAt))
    .limit(limit);

  const releaseConditions = appId ? [eq(releases.appId, appId)] : [];
  const releaseRows = await db
    .select({
      versionId: releases.versionId,
      id: releases.id,
      type: releases.type,
      published: releases.published,
    })
    .from(releases)
    .where(releaseConditions.length > 0 ? and(...releaseConditions) : undefined);

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
