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

  const job = await db
    .select()
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

  if (job.status !== "completed") {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: `Job is not completed. Current status: ${job.status}`,
    });
  }

  return {
    data: {
      jobId: job.id,
      repoUrl: job.repoUrl,
      status: job.status,
      srs: job.srsContent,
      fsd: job.fsdContent,
      sdd: job.sddContent,
      completedAt: job.completedAt,
    },
  };
});
