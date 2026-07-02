import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps, docGenerationJobs } from "~/server/database/schema";
import { loadGenerationResult } from "~/server/lib/generation-result";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({ statusCode: 400, message: "Share token is required" });
  }

  const job = await db
    .select({
      id: docGenerationJobs.id,
      appId: docGenerationJobs.appId,
      status: docGenerationJobs.status,
      shareEnabled: docGenerationJobs.shareEnabled,
      completedAt: docGenerationJobs.completedAt,
    })
    .from(docGenerationJobs)
    .where(and(eq(docGenerationJobs.shareToken, token), eq(docGenerationJobs.shareEnabled, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job || job.status !== "completed") {
    throw createError({ statusCode: 404, message: "Shared session not found" });
  }

  const app = await db
    .select({ name: apps.name })
    .from(apps)
    .where(eq(apps.id, job.appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({ statusCode: 404, message: "Shared session not found" });
  }

  const result = await loadGenerationResult(job.id, app.name);
  if (!result) {
    throw createError({ statusCode: 404, message: "Shared session not found" });
  }

  return {
    data: {
      ...result,
      sharedAt: job.completedAt,
    },
  };
});
