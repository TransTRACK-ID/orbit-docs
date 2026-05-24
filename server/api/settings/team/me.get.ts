import { defineEventHandler } from "h3";
import { getCurrentMember } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  const member = await getCurrentMember(event);
  return { data: member };
});
