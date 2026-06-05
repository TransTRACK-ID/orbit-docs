import { defineEventHandler } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getAuthUser } from "~/server/utils/auth";
import { formatLastActive } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();

  // Return pending invitations matching the current user's email
  const rows = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.email, user.email), eq(teamMembers.status, "pending")))
    .orderBy(teamMembers.createdAt);

  const formatted = rows.map((member) => ({
    ...member,
    lastActive: formatLastActive(member.lastActiveAt),
  }));
  return { data: formatted };
});
