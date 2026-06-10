import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { appRepositories } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const repoId = getRouterParam(event, "repoId");

  if (!appId || !repoId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and Repository ID are required",
    });
  }

  const existing = await db
    .select({ id: appRepositories.id, appId: appRepositories.appId })
    .from(appRepositories)
    .where(eq(appRepositories.id, repoId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.appId !== appId) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Repository not found" });
  }

  await db.delete(appRepositories).where(eq(appRepositories.id, repoId));

  return { data: { success: true, id: repoId } };
});
