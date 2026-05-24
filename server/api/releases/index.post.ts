import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { releases, apps, appVersions, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const {
    appId,
    versionId,
    heroTitle,
    summary,
    features,
    categories,
    published,
  } = body || {};

  if (!appId || typeof appId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  if (!versionId || typeof versionId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version ID is required",
    });
  }

  // Verify app exists
  const app = await db
    .select({ id: apps.id, name: apps.name })
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

  // Verify version exists and belongs to the app
  const version = await db
    .select({ id: appVersions.id, appId: appVersions.appId, version: appVersions.version })
    .from(appVersions)
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  if (version.appId !== appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version does not belong to the specified app",
    });
  }

  // Check for duplicate release on this version
  const existing = await db
    .select({ id: releases.id })
    .from(releases)
    .where(eq(releases.versionId, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "A release already exists for this version",
    });
  }

  const actor = getActorName(user);

  const release = await db
    .insert(releases)
    .values({
      appId,
      versionId,
      heroTitle: heroTitle || null,
      summary: summary || null,
      features: features || null,
      categories: categories || null,
      published: published === true,
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId,
    appName: app.name,
    action: `Release created for ${version.version}`,
    actor,
  });

  return { data: release };
});
