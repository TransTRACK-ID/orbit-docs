import { defineEventHandler, createError, getRouterParam } from "h3";
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

  const doc = await db
    .update(docs)
    .set({ status: "published" })
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "Doc published",
    user: doc.author || "System",
  });

  return { data: doc };
});
