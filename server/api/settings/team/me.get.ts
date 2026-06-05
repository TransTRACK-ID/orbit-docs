import { defineEventHandler } from "h3";
import { getCurrentMember, formatLastActive } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  const member = await getCurrentMember(event);
  if (member) {
    return { data: { ...member, lastActive: formatLastActive(member.lastActiveAt) } };
  }
  return { data: member };
});
