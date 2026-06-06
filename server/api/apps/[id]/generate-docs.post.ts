import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs, apps } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { generateDocs, updateJobProgress } from "~/server/lib/doc-generator";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  // Verify app exists
  const app = await db
    .select({ id: apps.id, repoUrl: apps.repoUrl })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App not found",
    });
  }

  const body = await readBody(event);
  const repoUrl = body?.repoUrl || app.repoUrl;

  if (!repoUrl || typeof repoUrl !== "string" || !repoUrl.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Repository URL is required",
    });
  }

  // Create the job record
  const job = await db
    .insert(docGenerationJobs)
    .values({
      appId,
      userId: user.id,
      repoUrl: repoUrl.trim(),
      status: "cloning",
      progressPct: 0,
      progressMessage: "Initializing...",
    })
    .returning()
    .then((rows) => rows[0]);

  // Start generation in background (fire-and-forget)
  generateDocs(job.id, repoUrl.trim(), async (update) => {
    // Progress updates are handled inside generateDocs via DB updates
    await updateJobProgress(job.id, update);
  }).catch((error) => {
    console.error(`Doc generation failed for job ${job.id}:`, error);
  });

  return {
    data: {
      jobId: job.id,
      status: job.status,
      progressPct: job.progressPct,
      progressMessage: job.progressMessage,
      createdAt: job.createdAt,
    },
  };
});
