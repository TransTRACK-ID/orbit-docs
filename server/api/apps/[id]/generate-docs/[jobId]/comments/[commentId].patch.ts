import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import {
  docGenerationComments,
  docGenerationJobs,
} from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");
  const commentId = getRouterParam(event, "commentId");
  const body = await readBody(event);

  if (!appId || !jobId || !commentId) {
    throw createError({ statusCode: 400, message: "Missing route parameters" });
  }

  const job = await db
    .select({ id: docGenerationJobs.id })
    .from(docGenerationJobs)
    .where(and(eq(docGenerationJobs.id, jobId), eq(docGenerationJobs.appId, appId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.status === "resolved" || body?.status === "open") {
    updates.status = body.status;
  }

  const [comment] = await db
    .update(docGenerationComments)
    .set(updates)
    .where(and(eq(docGenerationComments.id, commentId), eq(docGenerationComments.jobId, jobId)))
    .returning();

  if (!comment) {
    throw createError({ statusCode: 404, message: "Comment not found" });
  }

  return { data: comment };
});
