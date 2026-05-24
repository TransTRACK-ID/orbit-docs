import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, activityLogs } from "~/server/database/schema";
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
      message: "Embed doc ID is required",
    });
  }

  const existing = await db
    .select()
    .from(docEmbeds)
    .where(eq(docEmbeds.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Embed doc not found",
    });
  }

  await db.delete(docEmbeds).where(eq(docEmbeds.id, id));

  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: existing.title,
    action: "Embed doc deleted",
    actor: getActorName(user),
  });

  return { success: true };
});
