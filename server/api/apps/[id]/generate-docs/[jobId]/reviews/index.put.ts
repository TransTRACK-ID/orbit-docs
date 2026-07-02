import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationReviews, docGenerationJobs } from "~/server/database/schema";
import { requireAuth, getActorName } from "~/server/utils/auth";

const VALID_STATUSES = new Set(["in_review", "approved", "changes_requested"]);

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");
  const body = await readBody(event);

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
  }

  const { docKey, status } = body || {};
  if (!docKey || typeof docKey !== "string") {
    throw createError({ statusCode: 400, message: "docKey is required" });
  }
  if (!status || typeof status !== "string" || !VALID_STATUSES.has(status)) {
    throw createError({ statusCode: 400, message: "Invalid review status" });
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

  const existing = await db
    .select()
    .from(docGenerationReviews)
    .where(and(eq(docGenerationReviews.jobId, jobId), eq(docGenerationReviews.docKey, docKey)))
    .limit(1)
    .then((rows) => rows[0]);

  const actor = getActorName(user);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(docGenerationReviews)
      .set({ status, updatedBy: actor, updatedAt: now })
      .where(eq(docGenerationReviews.id, existing.id))
      .returning();
    return { data: updated };
  }

  const [created] = await db
    .insert(docGenerationReviews)
    .values({
      jobId,
      docKey,
      status,
      updatedBy: actor,
      updatedAt: now,
    })
    .returning();

  return { data: created };
});
