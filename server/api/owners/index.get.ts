import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { owners } from "~/server/database/schema";
import { desc, sql } from "drizzle-orm";
import { requireAnyPermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  // App editors pick an owner in the app form, so they need the list too.
  await requireAnyPermission(event, ["owners:read", "apps:write"]);
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
