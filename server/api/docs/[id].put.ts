import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const body = await readBody(event);
  const { title, appId, content, status, versionId, tags, author } = body || {};

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  const updateData: Partial<typeof docs.$inferInsert> = {};
  if (title !== undefined) updateData.title = title.trim();
  if (appId !== undefined) updateData.appId = appId || null;
  if (content !== undefined) updateData.content = content || "";
  if (status !== undefined) updateData.status = status;
  if (versionId !== undefined) updateData.versionId = versionId || null;
  if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
  if (author !== undefined) updateData.author = author || null;

  const doc = await db
    .update(docs)
    .set(updateData)
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "Doc updated",
    user: doc.author || "System",
  });

  return { data: doc };
});
