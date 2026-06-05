import { defineEventHandler } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { formatLastActive } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  const rows = await db.select().from(teamMembers).orderBy(teamMembers.createdAt);
  const formatted = rows.map((member) => ({
    ...member,
    lastActive: formatLastActive(member.lastActiveAt),
  }));
  return { data: formatted };
});
