import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { changelogs, changelogHistory } from "~/server/database/schema";
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

  const { content, status, versionId } = body || {};

  // Check changelog exists
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

  // Build update values
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };
  if (content !== undefined) updateData.content = content;
  if (status !== undefined) updateData.status = status;
  if (versionId !== undefined) updateData.versionId = versionId;

  const updated = await db
    .update(changelogs)
    .set(updateData)
    .where(eq(changelogs.id, id))
    .returning()
    .then((rows) => rows[0]);

  // Record history
  let action = "Updated changelog";
  if (status !== undefined && status !== existing.status) {
    action = `Status changed to ${status}`;
  }
  if (content !== undefined && content !== existing.content) {
    action = content === existing.content ? "Updated metadata" : "Edited content";
  }

  await db.insert(changelogHistory).values({
    changelogId: id,
    content: updated.content || "",
    action,
    actor,
  });

  return { data: updated };
});
