import { defineEventHandler, readBody, createError, setResponseStatus } from "h3";
import { getDb } from "~/server/database";
import { roles as rolesTable, rolePermissions } from "~/server/database/schema";
import { ALL_PERMISSION_KEYS, isValidRoleSlug } from "~/server/lib/permissions";
import {
  requireSuperAdmin,
  loadRolePermissionMatrix,
  invalidatePermissionCache,
} from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const body = await readBody(event);
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = body?.description;
  const level = body?.level;
  const cloneFrom = body?.cloneFrom;

  if (!isValidRoleSlug(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message:
        "Role slug must be 2-40 characters: lowercase letters, digits, underscores, starting with a letter.",
    });
  }
  if (!name || name.length > 60) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Role name is required (max 60 characters).",
    });
  }
  if (level !== undefined && (!Number.isInteger(level) || level < 0 || level > 100)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Role level must be an integer between 0 and 100.",
    });
  }
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 200)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Role description must be at most 200 characters.",
    });
  }

  const existing = await loadRoles();
  if (existing.some((r) => r.slug === slug)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: `A role with slug "${slug}" already exists.`,
    });
  }
  if (cloneFrom !== undefined && cloneFrom !== null && cloneFrom !== "") {
    if (!existing.some((r) => r.slug === cloneFrom)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: `Unknown role to clone: ${cloneFrom}`,
      });
    }
  }

  const db = getDb();
  const newRole = {
    slug,
    name,
    description: typeof description === "string" ? description : null,
    kind: "member" as const,
    isSystem: false,
    level: typeof level === "number" ? level : 0,
  };

  await db.insert(rolesTable).values({
    id: crypto.randomUUID(),
    slug: newRole.slug,
    name: newRole.name,
    description: newRole.description,
    kind: newRole.kind,
    isSystem: newRole.isSystem,
    level: newRole.level,
  });

  let permissions: Record<string, boolean>;
  if (cloneFrom) {
    const matrix = await loadRolePermissionMatrix();
    permissions = { ...(matrix[cloneFrom as string] ?? {}) };
  } else {
    permissions = {};
    for (const key of ALL_PERMISSION_KEYS) permissions[key] = false;
  }

  const values = ALL_PERMISSION_KEYS.map((permission) => ({
    id: crypto.randomUUID(),
    role: slug,
    permission,
    allowed: Boolean(permissions[permission]),
  }));
  if (values.length > 0) {
    await db.insert(rolePermissions).values(values);
  }

  invalidatePermissionCache();
  setResponseStatus(event, 201);
  return { data: newRole };
});
