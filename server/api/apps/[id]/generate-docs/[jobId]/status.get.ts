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

  // Set SSE headers
  event.node.res.setHeader("Content-Type", "text/event-stream");
  event.node.res.setHeader("Cache-Control", "no-cache");
  event.node.res.setHeader("Connection", "keep-alive");

  // Send initial data
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

  const sendEvent = (data: unknown) => {
    event.node.res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({
    status: job.status,
    progressPct: job.progressPct,
    progressMessage: job.progressMessage,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
  });

  // Poll for updates every 2 seconds
  const interval = setInterval(async () => {
    try {
      const updated = await db
        .select()
        .from(docGenerationJobs)
        .where(eq(docGenerationJobs.id, jobId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!updated) {
        clearInterval(interval);
        return;
      }

      sendEvent({
        status: updated.status,
        progressPct: updated.progressPct,
        progressMessage: updated.progressMessage,
        completedAt: updated.completedAt,
        errorMessage: updated.errorMessage,
      });

      // Close connection if completed or failed
      if (updated.status === "completed" || updated.status === "failed") {
        clearInterval(interval);
        event.node.res.end();
      }
    } catch {
      clearInterval(interval);
      event.node.res.end();
    }
  }, 2000);

  // Handle client disconnect
  event.node.res.on("close", () => {
    clearInterval(interval);
  });

  return new Promise(() => {
    // Keep the connection open until completed/failed or client disconnects
  });
});
