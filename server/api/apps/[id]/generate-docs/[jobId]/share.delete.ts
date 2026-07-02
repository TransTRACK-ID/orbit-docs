import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
  }

  const updated = await db
    .update(docGenerationJobs)
    .set({ shareEnabled: false })
    .where(and(eq(docGenerationJobs.id, jobId), eq(docGenerationJobs.appId, appId)))
    .returning({ id: docGenerationJobs.id })
    .then((rows) => rows[0]);

  if (!updated) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  return { data: { shareEnabled: false } };
});
