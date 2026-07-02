import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationComments, docGenerationJobs } from "~/server/database/schema";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");
  const body = await readBody(event);

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
  }

  const { docKey, text, quote } = body || {};
  if (!docKey || typeof docKey !== "string") {
    throw createError({ statusCode: 400, message: "docKey is required" });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    throw createError({ statusCode: 400, message: "Comment text is required" });
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

  const [comment] = await db
    .insert(docGenerationComments)
    .values({
      jobId,
      docKey,
      authorId: user.id,
      authorName: getActorName(user),
      body: text.trim(),
      quote: typeof quote === "string" && quote.trim() ? quote.trim().slice(0, 500) : null,
      status: "open",
    })
    .returning();

  return { data: comment };
});
