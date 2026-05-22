import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { apps } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const body = await readBody(event);
  const { name, description, owner, status, repoUrl } = body || {};

  const updateData: Partial<typeof apps.$inferInsert> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description || null;
  if (owner !== undefined) updateData.owner = owner || null;
  if (status !== undefined) updateData.status = status;
  if (repoUrl !== undefined) updateData.repoUrl = repoUrl || null;

  const app = await db
    .update(apps)
    .set(updateData)
    .where(eq(apps.id, id))
    .returning()
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  return { data: app };
});
