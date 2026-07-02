import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

function createShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
  }

  const job = await db
    .select()
    .from(docGenerationJobs)
    .where(and(eq(docGenerationJobs.id, jobId), eq(docGenerationJobs.appId, appId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  if (job.status !== "completed") {
    throw createError({
      statusCode: 409,
      message: "Only completed generation sessions can be shared",
    });
  }

  const shareToken = job.shareToken || createShareToken();
  const now = new Date();

  await db
    .update(docGenerationJobs)
    .set({
      shareToken,
      shareEnabled: true,
      sharedAt: job.sharedAt || now,
    })
    .where(eq(docGenerationJobs.id, jobId));

  return {
    data: {
      shareEnabled: true,
      shareToken,
      sharedAt: job.sharedAt || now,
    },
  };
});
