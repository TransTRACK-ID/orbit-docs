import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationComments, docGenerationJobs } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const jobId = getRouterParam(event, "jobId");

  if (!appId || !jobId) {
    throw createError({ statusCode: 400, message: "App ID and Job ID are required" });
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

  const comments = await db
    .select()
    .from(docGenerationComments)
    .where(eq(docGenerationComments.jobId, jobId))
    .orderBy(desc(docGenerationComments.createdAt));

  return {
    data: comments.map((c) => ({
      id: c.id,
      jobId: c.jobId,
      docKey: c.docKey,
      authorId: c.authorId,
      authorName: c.authorName,
      body: c.body,
      quote: c.quote,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
});
