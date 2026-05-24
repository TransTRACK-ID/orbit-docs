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

  const rows = await db
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
      releaseId: releases.id,
      releasePublished: releases.published,
    })
    .from(appVersions)
    .leftJoin(releases, eq(appVersions.id, releases.versionId))
    .where(eq(appVersions.appId, id))
    .orderBy(desc(appVersions.createdAt))
    .limit(limit);

  return { data: rows };
});
