import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { appVersions, apps, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const versionId = getRouterParam(event, "versionId");

  if (!appId || !versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and Version ID are required",
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

  const existing = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.appId !== appId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  const actor = getActorName(user);

  await db.delete(appVersions).where(eq(appVersions.id, versionId));

  await db.insert(activityLogs).values({
    appId: appId,
    appName: app.name,
    action: `Deleted ${existing.version}`,
    actor,
  });

  return { success: true };
});
