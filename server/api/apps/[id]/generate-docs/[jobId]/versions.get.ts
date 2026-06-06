import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs, docGenerationVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
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
    .select({ id: docGenerationJobs.id, appId: docGenerationJobs.appId })
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

  const versions = await db
    .select()
    .from(docGenerationVersions)
    .where(eq(docGenerationVersions.jobId, jobId))
    .orderBy(desc(docGenerationVersions.createdAt));

  return {
    data: versions,
  };
});