import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { internalAppFeedback } from "~/server/database/schema";
import { desc, eq, and } from "drizzle-orm";
import { requireSuperAdminAccess } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  await requireSuperAdminAccess(event);
  const db = getDb();
  const query = getQuery(event);

  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const categoryFilter = typeof query.category === "string" ? query.category : "";
  const limit = Math.min(parseInt(String(query.limit || "50"), 10), 100);

  const conditions = [];
  if (statusFilter) {
    conditions.push(
      eq(internalAppFeedback.status, statusFilter as "open" | "resolved" | "closed")
    );
  }
  if (categoryFilter) {
    conditions.push(
      eq(internalAppFeedback.category, categoryFilter as "general" | "bug" | "feature" | "docs")
    );
  }

  const rows = await db
    .select({
      id: internalAppFeedback.id,
      userId: internalAppFeedback.userId,
      userName: internalAppFeedback.userName,
      userEmail: internalAppFeedback.userEmail,
      category: internalAppFeedback.category,
      comment: internalAppFeedback.comment,
      status: internalAppFeedback.status,
      createdAt: internalAppFeedback.createdAt,
      updatedAt: internalAppFeedback.updatedAt,
    })
    .from(internalAppFeedback)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(internalAppFeedback.createdAt))
    .limit(limit);

  let result = rows;
  if (search) {
    result = rows.filter((r) => {
      const haystack = [r.userName, r.userEmail, r.comment, r.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const total = result.length;
  const open = result.filter((r) => r.status === "open").length;

  return {
    data: result,
    stats: { total, open },
  };
});
