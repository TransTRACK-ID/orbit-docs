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

  // Fetch latest versions for each doc type
  const versions = await db
    .select()
    .from(docGenerationVersions)
    .where(eq(docGenerationVersions.jobId, jobId))
    .orderBy(desc(docGenerationVersions.createdAt));

  // Group by docType and get latest
  const latestVersions: Record<string, typeof versions[0] | undefined> = {};
  for (const v of versions) {
    if (!latestVersions[v.docType]) {
      latestVersions[v.docType] = v;
    }
  }

  return {
    data: {
      jobId: job.id,
      repoUrl: job.repoUrl,
      repoRef: job.repoRef,
      status: job.status,
      srs: latestVersions.srs?.content ?? job.srsContent,
      fsd: latestVersions.fsd?.content ?? job.fsdContent,
      sdd: latestVersions.sdd?.content ?? job.sddContent,
      completedAt: job.completedAt,
      versions: versions.map((v) => ({
        id: v.id,
        docType: v.docType,
        content: v.content,
        actor: v.actor,
        createdAt: v.createdAt,
      })),
    },
  };
});
