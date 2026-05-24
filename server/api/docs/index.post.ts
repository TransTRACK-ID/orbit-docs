import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docs, activityLogs } from "~/server/database/schema";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const body = await readBody(event);

  const { title, appId, content, status, versionId, tags, author } = body || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc title is required",
    });
  }

  const doc = await db
    .insert(docs)
    .values({
      title: title.trim(),
      appId: appId || null,
      content: content || "",
      status: status || "draft",
      versionId: versionId || null,
      tags: Array.isArray(tags) ? tags : [],
      author: author || "System",
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "Doc created",
    user: doc.author || "System",
  });

  return { data: doc };
});
