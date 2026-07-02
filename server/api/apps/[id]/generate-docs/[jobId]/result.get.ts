import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { loadGenerationResult } from "~/server/lib/generation-result";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");

  if (!appId || !jobId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and Job ID are required",
    });
  }

  const app = await db
    .select({ name: apps.name })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({ statusCode: 404, message: "App not found" });
  }

  const result = await loadGenerationResult(jobId, app.name);
  if (!result || result.appId !== appId) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  if (result.status !== "completed") {
    throw createError({
      statusCode: 409,
      message: `Job is not completed. Current status: ${result.status}`,
    });
  }

  return { data: result };
});
