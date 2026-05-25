import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { changelogHistory } from "~/server/database/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Changelog ID is required",
    });
  }

  const rows = await db
    .select()
    .from(changelogHistory)
    .where(eq(changelogHistory.changelogId, id))
    .orderBy(desc(changelogHistory.createdAt))
    .limit(100);

  return { data: rows };
});
