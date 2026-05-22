import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { activityLogs } from "~/server/database/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);
  const limit = Math.min(parseInt(String(query.limit || "10"), 10), 50);

  const logs = await db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return { data: logs };
});
