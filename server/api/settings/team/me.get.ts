import { defineEventHandler } from "h3";
import { getCurrentMember, formatLastActive } from "~/server/utils/team-access";
import { getAuthContext } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  const member = await getCurrentMember(event);
  const access = await getAuthContext(event);

  if (!member) {
    return {
      data: {
        isSuperAdmin: access.isSuperAdmin,
        permissions: access.permissions,
        role: access.role,
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
    },
  };
});
