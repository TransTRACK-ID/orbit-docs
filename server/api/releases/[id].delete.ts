import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { releases, apps, activityLogs } from "~/server/database/schema";
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
      message: "Release ID is required",
    });
  }

  const existing = await db
    .select()
    .from(releases)
    .where(eq(releases.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Release not found",
    });
  }

  await db.delete(releases).where(eq(releases.id, id));

  const app = await db
    .select({ name: apps.name })
    .from(apps)
    .where(eq(apps.id, existing.appId))
    .limit(1)
    .then((rows) => rows[0]);

  const actor = getActorName(user);
  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: app?.name || null,
    action: `Release deleted`,
    actor,
  });

  return { success: true };
});
