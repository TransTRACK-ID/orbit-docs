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
    if (event.node.res.writableEnded || event.node.res.destroyed) {
      return;
    }
    try {
      event.node.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Ignore write errors (client may have disconnected)
    }
  };

  const serializeJob = (j: typeof job) => ({
    status: j.status,
    progressPct: j.progressPct,
    progressMessage: j.progressMessage,
    repoRef: j.repoRef,
    completedAt: j.completedAt,
    errorMessage: j.errorMessage,
    // Live-progress fields driven by the streaming agent.
    currentActivity: j.currentActivity,
    partialContent: j.partialContent,
    lastEventAt: j.lastEventAt,
    tokensInput: j.tokensInput,
    tokensOutput: j.tokensOutput,
    opencodeSessionId: j.opencodeSessionId,
  });

  sendEvent(serializeJob(job));

  // Poll faster (1s) — the agent now emits live activity / streaming text and
  // the UI benefits from a responsive feed. DB load is unchanged from the
  // previous 2s poll because we only run one SELECT per tick.
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

      sendEvent(serializeJob(updated));

      // Close connection if completed, failed, or cancelled
      if (updated.status === "completed" || updated.status === "failed" || updated.status === "cancelled") {
        clearInterval(interval);
        if (!event.node.res.writableEnded && !event.node.res.destroyed) {
          event.node.res.end();
        }
      }
    } catch {
      clearInterval(interval);
      if (!event.node.res.writableEnded && !event.node.res.destroyed) {
        event.node.res.end();
      }
    }
  }, 1000);

  // Handle client disconnect
  event.node.res.on("close", () => {
    clearInterval(interval);
  });

  return new Promise(() => {
    // Keep the connection open until completed/failed or client disconnects
  });
});
