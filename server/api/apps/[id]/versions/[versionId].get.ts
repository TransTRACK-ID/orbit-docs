import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { appVersions, releases, apps } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const versionId = getRouterParam(event, "versionId");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  if (!versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version ID is required",
    });
  }

  const row = await db
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
      appName: apps.name,
    })
    .from(appVersions)
    .innerJoin(apps, eq(appVersions.appId, apps.id))
    .leftJoin(releases, eq(appVersions.id, releases.versionId))
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  if (row.appId !== appId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version does not belong to this app",
    });
  }

  return { data: row };
});
