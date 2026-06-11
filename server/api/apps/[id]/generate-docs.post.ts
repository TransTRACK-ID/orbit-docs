import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs, apps, appRepositories } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import { generateProductDocs, updateJobProgress } from "~/server/lib/doc-generator";

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

  // A product run needs at least one configured repository (or the legacy
  // single repoUrl on the app for backward compatibility).
  const repos = await db
    .select({ id: appRepositories.id })
    .from(appRepositories)
    .where(eq(appRepositories.appId, appId));

  if (repos.length === 0 && !app.repoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Add at least one repository before generating docs",
    });
  }

  // Create the product-scoped job record
  const job = await db
    .insert(docGenerationJobs)
    .values({
      appId,
      userId: user.id,
      repoUrl: app.repoUrl ?? null,
      scope: "product",
      trigger: "manual",
      status: "cloning",
      progressPct: 0,
      progressMessage: "Initializing...",
    })
    .returning()
    .then((rows) => rows[0]);

  // Parse optional cursor model override from the request body
  const body = await readBody(event).catch(() => ({}));
  const cursorModel = body?.cursorModel;

  // Start generation in background (fire-and-forget)
  generateProductDocs(job.id, appId, async (update) => {
    await updateJobProgress(job.id, update);
  }, { cursorModel }).catch((error) => {
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
