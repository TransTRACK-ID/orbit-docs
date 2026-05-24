import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
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

  const body = await readBody(event);
  const {
    heroTitle,
    summary,
    features,
    categories,
    published,
  } = body || {};

  const updateData: Partial<typeof releases.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (heroTitle !== undefined) updateData.heroTitle = heroTitle || null;
  if (summary !== undefined) updateData.summary = summary || null;
  if (features !== undefined) updateData.features = features || null;
  if (categories !== undefined) updateData.categories = categories || null;
  if (published !== undefined) updateData.published = published === true;

  const updated = await db
    .update(releases)
    .set(updateData)
    .where(eq(releases.id, id))
    .returning()
    .then((rows) => rows[0]);

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
    action: `Release updated`,
    actor,
  });

  return { data: updated };
});
