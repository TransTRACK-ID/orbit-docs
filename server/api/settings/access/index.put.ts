import { defineEventHandler, readBody, createError } from "h3";
import type { PermissionKey, RolePermissionMatrix } from "~/types/permissions";
import type { TeamRole } from "~/types/settings";
import {
  ALL_PERMISSION_KEYS,
  TEAM_ROLES,
  PERMISSION_GROUPS,
} from "~/server/lib/permissions";
import { requireSuperAdmin, saveRolePermissionMatrix } from "~/server/utils/rbac";

function isValidMatrix(body: unknown): body is RolePermissionMatrix {
  if (!body || typeof body !== "object") return false;

  for (const role of TEAM_ROLES) {
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

  if (!isValidMatrix(body?.matrix)) {
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
      roles: TEAM_ROLES,
    },
  };
});
