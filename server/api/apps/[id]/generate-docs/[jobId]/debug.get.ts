import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs, docGenerationDebugLogs } from "~/server/database/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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

  // Verify job belongs to app
  const job = await db
    .select({ id: docGenerationJobs.id })
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job || job.id !== jobId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Job not found",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 200, 500);
  const offset = Number(query.offset) || 0;

  const logs = await db
    .select()
    .from(docGenerationDebugLogs)
    .where(eq(docGenerationDebugLogs.jobId, jobId))
    .orderBy(desc(docGenerationDebugLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(docGenerationDebugLogs)
    .where(eq(docGenerationDebugLogs.jobId, jobId))
    .then((rows) => rows[0]?.count ?? 0);

  return {
    data: logs.map((log) => ({
      ...log,
      eventData: safeJsonParse(log.eventData),
    })),
    meta: { total, limit, offset },
  };
});

function safeJsonParse(val: string | null): Record<string, unknown> {
  if (!val) return {};
  try {
    return JSON.parse(val) as Record<string, unknown>;
  } catch {
    return { raw: val };
  }
}
