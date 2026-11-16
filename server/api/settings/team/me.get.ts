import { defineEventHandler } from "h3";
import { getCurrentMember, formatLastActive, canManageMembers } from "~/server/utils/team-access";
import { getAuthContext } from "~/server/utils/rbac";
import { getSessionToken } from "~/server/utils/auth";
import { loadRoles } from "~/server/utils/roles";
import { roleLevel } from "~/server/lib/permissions";

export default defineEventHandler(async (event) => {
  if (!getSessionToken(event)) {
    return { data: null };
  }

  const member = await getCurrentMember(event);
  const access = await getAuthContext(event);
  const allRoles = await loadRoles();
  const effectiveRole = access.role ?? member?.role ?? null;
  const roleDef = allRoles.find((r) => r.slug === effectiveRole) ?? null;
  const rName = roleDef?.name ?? null;
  const rLevel = roleLevel(allRoles, effectiveRole);
  const canManage = effectiveRole ? canManageMembers(effectiveRole, allRoles) : false;

  if (!member) {
    return {
      data: {
        isSuperAdmin: access.isSuperAdmin,
        permissions: access.permissions,
        role: access.role,
        roleName: rName,
        roleLevel: rLevel,
        canManageTeam: canManage,
      },
    };
  }

  return {
    data: {
      ...member,
      lastActive: formatLastActive(member.lastActiveAt),
      isSuperAdmin: access.isSuperAdmin,
      permissions: access.permissions,
      role: access.role ?? member.role,
      roleName: rName,
      roleLevel: rLevel,
      canManageTeam: canManage,
    },
  };
});
