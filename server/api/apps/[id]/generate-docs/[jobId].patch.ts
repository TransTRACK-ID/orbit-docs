import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

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

  // Verify the job belongs to this app
  const job = await db
    .select({
      id: docGenerationJobs.id,
      appId: docGenerationJobs.appId,
      status: docGenerationJobs.status,
    })
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job || job.appId !== appId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Job not found",
    });
  }

  // Can only cancel active jobs
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "Job is not active and cannot be cancelled",
    });
  }

  await db
    .update(docGenerationJobs)
    .set({
      status: "cancelled",
      progressPct: 0,
      progressMessage: "Cancelled by user",
      errorMessage: "Generation cancelled by user",
    })
    .where(eq(docGenerationJobs.id, jobId));

  return {
    data: {
      success: true,
      message: "Job cancelled",
      jobId,
      status: "cancelled",
    },
  };
});
