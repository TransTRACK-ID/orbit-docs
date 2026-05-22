import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { apps, appVersions } from "~/server/database/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const app = await db
    .select({
      id: apps.id,
      name: apps.name,
      description: apps.description,
      owner: apps.owner,
      status: apps.status,
      repoUrl: apps.repoUrl,
      createdAt: apps.createdAt,
      updatedAt: apps.updatedAt,
    })
    .from(apps)
    .where(eq(apps.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  const latestVersion = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.appId, app.id))
    .orderBy(desc(appVersions.createdAt))
    .limit(1)
    .then((rows) => rows[0] || null);

  return {
    data: {
      ...app,
      latestVersion: latestVersion
        ? {
            id: latestVersion.id,
            version: latestVersion.version,
            status: latestVersion.status,
            createdBy: latestVersion.createdBy,
          }
        : null,
    },
  };
});
