import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { apps, activityLogs } from "~/server/database/schema";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const body = await readBody(event);

  const { name, description, owner, status, repoUrl } = body || {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App name is required",
    });
  }

  const app = await db
    .insert(apps)
    .values({
      name: name.trim(),
      description: description || null,
      owner: owner || null,
      status: status || "active",
      repoUrl: repoUrl || null,
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: app.id,
    appName: app.name,
    action: "App created",
    user: owner || "System",
  });

  return { data: app };
});
