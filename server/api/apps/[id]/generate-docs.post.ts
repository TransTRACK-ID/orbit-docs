import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs, apps, appRepositories } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import { generateProductDocs, generateWikiDocs, updateJobProgress } from "~/server/lib/doc-generator";
import { assertDocAgentReady } from "~/server/lib/agent-readiness";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  await assertDocAgentReady();
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

  // Parse optional body: cursor model override, generation scope
  const body = await readBody(event).catch(() => ({}));
  const cursorModel = body?.cursorModel;
  const scope = body?.scope === "wiki" ? "wiki" : "product";

  const job = await db
    .insert(docGenerationJobs)
    .values({
      appId,
      userId: user.id,
      repoUrl: app.repoUrl ?? null,
      scope,
      trigger: "manual",
      status: "cloning",
      progressPct: 0,
      progressMessage: "Initializing...",
    })
    .returning()
    .then((rows) => rows[0]);

  const runGeneration =
    scope === "wiki"
      ? (onProgress: Parameters<typeof generateWikiDocs>[2]) =>
          generateWikiDocs(job.id, appId, onProgress, { cursorModel })
      : (onProgress: Parameters<typeof generateProductDocs>[2]) =>
          generateProductDocs(job.id, appId, onProgress, { cursorModel });

  runGeneration(async (update) => {
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
