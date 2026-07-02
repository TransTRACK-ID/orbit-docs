import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationJobs, apps } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
  }

  const job = await db
    .select({
      shareEnabled: docGenerationJobs.shareEnabled,
      shareToken: docGenerationJobs.shareToken,
      sharedAt: docGenerationJobs.sharedAt,
      status: docGenerationJobs.status,
      appId: docGenerationJobs.appId,
    })
    .from(docGenerationJobs)
    .where(and(eq(docGenerationJobs.id, jobId), eq(docGenerationJobs.appId, appId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  return {
    data: {
      shareEnabled: job.shareEnabled,
      shareToken: job.shareToken,
      sharedAt: job.sharedAt,
      canShare: job.status === "completed",
    },
  };
});
