import { defineEventHandler, readBody, createError } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps, appVersions, releases } from "~/server/database/schema";
import { requirePermission } from "~/server/utils/rbac";
import { isS3Configured } from "~/server/utils/runtime-env";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_ZIP_BYTES,
  createImportSession,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");

  if (!isS3Configured()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "Object storage is not configured. Set S3_BUCKET, S3_REGION, and credentials.",
    });
  }

  const body = await readBody(event);
  const { fileName, totalSize, appId, versionId, heroTitle } = body || {};

  if (typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".zip")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "A .zip file is required",
    });
  }

  if (
    typeof totalSize !== "number" ||
    !Number.isFinite(totalSize) ||
    totalSize <= 0 ||
    totalSize > IMPORT_MAX_ZIP_BYTES
  ) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `Archive must be smaller than ${Math.round(IMPORT_MAX_ZIP_BYTES / 1024 / 1024)} MB`,
    });
  }

  if (!appId || typeof appId !== "string" || !versionId || typeof versionId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and Version ID are required",
    });
  }

  const db = getDb();

  const app = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  const version = await db
    .select({ id: appVersions.id, appId: appVersions.appId })
    .from(appVersions)
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!version || version.appId !== appId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found for the selected app",
    });
  }

  const existing = await db
    .select({ id: releases.id, type: releases.type })
    .from(releases)
    .where(eq(releases.versionId, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing && existing.type === "article") {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "An article release already exists for this version",
      data: { existingReleaseId: existing.id, existingType: existing.type },
    });
  }

  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(totalSize / IMPORT_CHUNK_SIZE);

  await createImportSession({
    uploadId,
    userId: user.id,
    fileName,
    totalSize,
    totalChunks,
    appId,
    versionId,
    heroTitle: typeof heroTitle === "string" ? heroTitle.trim() : "",
    status: "uploading",
    createdAt: Date.now(),
  });

  return {
    data: {
      uploadId,
      chunkSize: IMPORT_CHUNK_SIZE,
      totalChunks,
    },
  };
});
