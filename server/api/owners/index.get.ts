import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { owners } from "~/server/database/schema";
import { desc, sql } from "drizzle-orm";
import { requirePermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "apps:read");
  const db = getDb();
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";

  const allOwners = await db
    .select({
      id: owners.id,
      name: owners.name,
      email: owners.email,
      role: owners.role,
      createdAt: owners.createdAt,
      updatedAt: owners.updatedAt,
    })
    .from(owners)
    .where(
      search
        ? sql`${owners.name} LIKE ${"%" + search + "%"}`
        : undefined
    )
    .orderBy(desc(owners.updatedAt));

  return { data: allOwners };
});
