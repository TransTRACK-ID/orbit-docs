import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { roles as rolesTable, rolePermissions, teamMembers, mcpServicePrincipals } from "~/server/database/schema";
import { requireSuperAdmin, invalidatePermissionCache } from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const slug = getRouterParam(event, "slug");
  const existingRoles = await loadRoles();
  const existing = existingRoles.find((r) => r.slug === slug);
  if (!slug || !existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Role not found.",
    });
  }
  if (existing.isSystem) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "System roles cannot be deleted.",
    });
  }

  const db = getDb();
  const memberCount = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.role, slug))
    .then((rows) => rows.length);
  const keyCount = await db
    .select({ id: mcpServicePrincipals.id })
    .from(mcpServicePrincipals)
    .where(eq(mcpServicePrincipals.role, slug))
    .then((rows) => rows.length);

  if (memberCount > 0 || keyCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: `Role is in use by ${memberCount} member(s) and ${keyCount} MCP key(s). Reassign them first.`,
    });
  }

  await db.delete(rolePermissions).where(eq(rolePermissions.role, slug));
  await db.delete(rolesTable).where(eq(rolesTable.slug, slug));
  invalidatePermissionCache();

  return { success: true };
});
