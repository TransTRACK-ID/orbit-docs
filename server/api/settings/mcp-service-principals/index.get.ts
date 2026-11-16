import { defineEventHandler } from "h3";
import { asc } from "drizzle-orm";
import { getDb } from "~/server/database";
import { mcpServicePrincipals } from "~/server/database/schema";
import { requireSuperAdmin } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpServicePrincipals)
    .orderBy(asc(mcpServicePrincipals.createdAt));

  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      isActive: row.isActive,
      isEnvKey: row.keyHash === null,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    })),
  };
});
