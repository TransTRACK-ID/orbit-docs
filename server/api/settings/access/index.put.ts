import { defineEventHandler, readBody, createError } from "h3";
import type { RolePermissionMatrix } from "~/types/permissions";
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS } from "~/server/lib/permissions";
import { requireSuperAdmin, saveRolePermissionMatrix } from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

async function isValidMatrix(body: unknown): Promise<boolean> {
  if (!body || typeof body !== "object") return false;
  const slugs = (await loadRoles()).map((r) => r.slug);
  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.length !== slugs.length || !slugs.every((s) => keys.includes(s))) return false;
  for (const role of slugs) {
    const roleMatrix = (body as RolePermissionMatrix)[role];
    if (!roleMatrix || typeof roleMatrix !== "object") return false;
    for (const key of ALL_PERMISSION_KEYS) {
      if (typeof roleMatrix[key] !== "boolean") return false;
    }
  }
  return true;
}

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const body = await readBody(event);

  if (!(await isValidMatrix(body?.matrix))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid permission matrix payload.",
    });
  }

  await saveRolePermissionMatrix(body.matrix as RolePermissionMatrix);

  return {
    data: {
      groups: PERMISSION_GROUPS,
      matrix: body.matrix,
      roles: await loadRoles(),
    },
  };
});
