import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { changelogs, apps, appVersions, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const { appId, versionId, title, content, status } = body || {};

  if (!appId || typeof appId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Title is required",
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

  // Verify version exists and belongs to the app (if provided)
  if (versionId) {
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
  }

  const actor = getActorName(user);

  const changelog = await db
    .insert(changelogs)
    .values({
      appId,
      versionId: versionId || null,
      title: title.trim(),
      content: content || "",
      status: status === "published" ? "published" : "draft",
      createdBy: actor,
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId,
    appName: app.name,
    action: `Changelog "${changelog.title}" created`,
    actor,
  });

  return { data: changelog };
});
