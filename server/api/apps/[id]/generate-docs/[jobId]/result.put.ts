import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
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

  const body = await readBody(event);
  const { srs, fsd, sdd } = body;

  // Update the job content
  await db
    .update(docGenerationJobs)
    .set({
      srsContent: srs ?? job.srsContent,
      fsdContent: fsd ?? job.fsdContent,
      sddContent: sdd ?? job.sddContent,
    })
    .where(eq(docGenerationJobs.id, jobId));

  // Create version entries for each changed doc
  const session = await requireAuth(event);
  const actor = session?.user?.name || session?.user?.email || "unknown";

  const now = new Date();
  if (srs !== undefined && srs !== job.srsContent) {
    await db.insert(docGenerationVersions).values({
      jobId,
      docType: "srs",
      content: srs,
      actor,
      createdAt: now,
    });
  }
  if (fsd !== undefined && fsd !== job.fsdContent) {
    await db.insert(docGenerationVersions).values({
      jobId,
      docType: "fsd",
      content: fsd,
      actor,
      createdAt: now,
    });
  }
  if (sdd !== undefined && sdd !== job.sddContent) {
    await db.insert(docGenerationVersions).values({
      jobId,
      docType: "sdd",
      content: sdd,
      actor,
      createdAt: now,
    });
  }

  return {
    data: {
      success: true,
      message: "Generated documents updated",
      jobId,
    },
  };
});