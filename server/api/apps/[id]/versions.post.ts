import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { appVersions, apps, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  // Verify app exists
  const app = await db
    .select({ id: apps.id, name: apps.name })
    .from(apps)
    .where(eq(apps.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  const body = await readBody(event);
  const {
    version,
    status,
    releaseDate,
    releaseNotes,
    branch,
    tags,
    commitHash,
    approver,
    ciStatus,
  } = body || {};

  if (!version || typeof version !== "string" || version.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version number is required",
    });
  }

  const actor = getActorName(user);

  const newVersion = await db
    .insert(appVersions)
    .values({
      appId: id,
      version: version.trim(),
      status: status || "draft",
      createdBy: actor,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      releaseNotes: releaseNotes || null,
      branch: branch || null,
      tags: tags || null,
      commitHash: commitHash || null,
      approver: approver || actor,
      ciStatus: ciStatus || "unknown",
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: id,
    appName: app.name,
    action: `Created ${version.trim()}`,
    actor,
  });

  return { data: newVersion };
});
