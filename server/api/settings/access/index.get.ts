import { defineEventHandler } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { PERMISSION_GROUPS } from "~/server/lib/permissions";
import { loadRolePermissionMatrix } from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const matrix = await loadRolePermissionMatrix();

  return {
    data: {
      groups: PERMISSION_GROUPS,
      matrix,
      roles: await loadRoles(),
    },
  };
});
