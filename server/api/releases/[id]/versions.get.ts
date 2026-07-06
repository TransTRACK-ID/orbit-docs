import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { releases, releaseVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Release ID is required" });
  }

  const existing = await db
    .select()
    .from(releases)
    .where(eq(releases.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({ statusCode: 404, message: "Release not found" });
  }

  const versions = await db
    .select()
    .from(releaseVersions)
    .where(eq(releaseVersions.releaseId, id))
    .orderBy(desc(releaseVersions.createdAt));

  return { data: versions };
});
