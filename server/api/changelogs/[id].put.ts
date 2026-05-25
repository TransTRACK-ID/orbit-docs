import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { changelogs, apps, appVersions, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Changelog ID is required",
    });
  }

  const { title, content, status, versionId } = body || {};

  const existing = await db
    .select()
    .from(changelogs)
    .where(eq(changelogs.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Changelog not found",
    });
  }

  // Verify version exists and belongs to the app (if provided)
  if (versionId) {
    const version = await db
      .select({ id: appVersions.id, appId: appVersions.appId })
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

    if (version.appId !== existing.appId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Version does not belong to the specified app",
      });
    }
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;
  if (versionId !== undefined) updates.versionId = versionId || null;
  updates.updatedAt = new Date();

  const actor = getActorName(user);

  const updated = await db
    .update(changelogs)
    .set(updates)
    .where(eq(changelogs.id, id))
    .returning()
    .then((rows) => rows[0]);

  const app = await db
    .select({ name: apps.name })
    .from(apps)
    .where(eq(apps.id, existing.appId))
    .limit(1)
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: app?.name || null,
    action: `Changelog "${updated.title}" updated`,
    actor,
  });

  return { data: updated };
});
