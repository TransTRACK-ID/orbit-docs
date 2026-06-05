import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const query = getQuery(event);
  const limit =
    typeof query.limit === "string" ? parseInt(query.limit, 10) || 20 : 20;
  const offset =
    typeof query.offset === "string" ? parseInt(query.offset, 10) || 0 : 0;

  const jobs = await db
    .select({
      id: docGenerationJobs.id,
      appId: docGenerationJobs.appId,
      repoUrl: docGenerationJobs.repoUrl,
      status: docGenerationJobs.status,
      progressPct: docGenerationJobs.progressPct,
      progressMessage: docGenerationJobs.progressMessage,
      createdAt: docGenerationJobs.createdAt,
      completedAt: docGenerationJobs.completedAt,
      errorMessage: docGenerationJobs.errorMessage,
    })
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.appId, appId))
    .orderBy(desc(docGenerationJobs.createdAt))
    .limit(limit)
    .offset(offset);

  return { data: jobs };
});
