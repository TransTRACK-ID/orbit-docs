import { defineEventHandler, getRouterParam, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { versionHistory } from "~/server/database/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  const versionId = getRouterParam(event, "versionId");
  const limit = Math.min(parseInt(String(getQuery(event).limit || "20"), 10), 50);

  if (!versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "versionId is required",
    });
  }

  const logs = await db
    .select()
    .from(versionHistory)
    .where(eq(versionHistory.versionId, versionId))
    .orderBy(desc(versionHistory.createdAt))
    .limit(limit);

  return { data: logs };
});