import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { changelogs, changelogHistory } from "~/server/database/schema";
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
      message: "Changelog ID is required",
    });
  }

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

  const actor = getActorName(user);

  const updated = await db
    .update(changelogs)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(changelogs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(changelogHistory).values({
    changelogId: id,
    content: updated.content || "",
    action: "Published changelog",
    actor,
  });

  return { data: updated };
});
