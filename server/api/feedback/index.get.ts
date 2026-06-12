import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { docFeedback, docs, apps } from "~/server/database/schema";
import { desc, eq, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const query = getQuery(event);

  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const appFilter = typeof query.app === "string" ? query.app : "";
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const helpfulFilter = typeof query.helpful === "string" ? query.helpful : "";
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  const conditions = [];
  if (appFilter) {
    conditions.push(eq(docFeedback.appId, appFilter));
  }
  if (statusFilter) {
    conditions.push(eq(docFeedback.status, statusFilter as "open" | "resolved" | "closed"));
  }
  if (helpfulFilter === "true") {
    conditions.push(eq(docFeedback.helpful, true));
  } else if (helpfulFilter === "false") {
    conditions.push(eq(docFeedback.helpful, false));
  }

  const rows = await db
    .select({
      id: docFeedback.id,
      docId: docFeedback.docId,
      appId: docFeedback.appId,
      helpful: docFeedback.helpful,
      comment: docFeedback.comment,
      status: docFeedback.status,
      visitorId: docFeedback.visitorId,
      createdAt: docFeedback.createdAt,
      updatedAt: docFeedback.updatedAt,
      docTitle: docs.title,
      appName: apps.name,
    })
    .from(docFeedback)
    .innerJoin(docs, eq(docFeedback.docId, docs.id))
    .leftJoin(apps, eq(docFeedback.appId, apps.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(docFeedback.createdAt))
    .limit(limit);

  let result = rows;
  if (search) {
    result = rows.filter((r) => {
      const haystack = [r.docTitle, r.appName, r.comment]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const total = result.length;
  const helpful = result.filter((r) => r.helpful).length;
  const notHelpful = result.filter((r) => !r.helpful).length;
  const open = result.filter((r) => r.status === "open").length;

  return {
    data: result,
    stats: { total, helpful, notHelpful, open },
  };
});
