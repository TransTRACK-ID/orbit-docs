import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { mcpServicePrincipals } from "~/server/database/schema";
import { requireSuperAdmin } from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  const db = getDb();
  const existing = id
    ? await db
        .select()
        .from(mcpServicePrincipals)
        .where(eq(mcpServicePrincipals.id, id))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "MCP key not found.",
    });
  }

  const body = await readBody(event);
  const updateData: { name?: string; role?: string; isActive?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Key name is required (max 60 characters).",
      });
    }
    updateData.name = name;
  }
  if (body?.role !== undefined) {
    const allRoles = await loadRoles();
    if (!allRoles.some((r) => r.slug === body.role)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: `Unknown role: ${body.role}`,
      });
    }
    updateData.role = body.role;
  }
  if (body?.isActive !== undefined) {
    updateData.isActive = Boolean(body.isActive);
  }

  const updated = await db
    .update(mcpServicePrincipals)
    .set(updateData)
    .where(eq(mcpServicePrincipals.id, existing.id))
    .returning()
    .then((rows) => rows[0]);

  return {
    data: {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      isEnvKey: updated.keyHash === null,
      createdAt: updated.createdAt,
      lastUsedAt: updated.lastUsedAt,
    },
  };
});
