import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { roles as rolesTable } from "~/server/database/schema";
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

  const body = await readBody(event);
  const updateData: { name?: string; description?: string | null; level?: number; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Role name is required (max 60 characters).",
      });
    }
    updateData.name = name;
  }
  if (body?.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 200)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Role description must be at most 200 characters.",
      });
    }
    updateData.description = body.description;
  }
  if (body?.level !== undefined) {
    if (!Number.isInteger(body.level) || body.level < 0 || body.level > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Role level must be an integer between 0 and 100.",
      });
    }
    updateData.level = body.level;
  }

  const db = getDb();
  await db.update(rolesTable).set(updateData).where(eq(rolesTable.slug, slug));
  invalidatePermissionCache();

  return {
    data: {
      ...existing,
      ...(updateData.name !== undefined ? { name: updateData.name } : {}),
      ...(updateData.description !== undefined ? { description: updateData.description } : {}),
      ...(updateData.level !== undefined ? { level: updateData.level } : {}),
    },
  };
});
