import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireTeamAccess, canInviteRole, getCurrentMember } from "~/server/utils/team-access";
import type { TeamRole } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  const user = await requireTeamAccess(event, "product_manager");
  const db = getDb();
  const body = await readBody(event);

  const { name, email, initials, role, lastActive } = body || {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Member name is required",
    });
  }

  const targetRole: TeamRole = role || "viewer";
  const currentMember = await getCurrentMember(event);

  if (!currentMember) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Only active team members can invite users.",
    });
  }

  // Role-based invitation restriction
  if (!canInviteRole(currentMember.role as TeamRole, targetRole)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: `You do not have permission to invite a user with the ${targetRole} role.`,
    });
  }

  // Prevent duplicate active member by email
  if (email) {
    const existing = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.email, email.trim()), eq(teamMembers.status, "active")))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        message: "An active team member with this email already exists.",
      });
    }
  }

  const now = new Date();
  const member = await db
    .insert(teamMembers)
    .values({
      name: name.trim(),
      email: email ? email.trim() : null,
      initials: initials || name.trim().slice(0, 2).toUpperCase(),
      role: targetRole,
      status: "pending",
      invitedBy: currentMember.name,
      lastActive: lastActive || "invited",
      lastActiveAt: now,
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: { ...member, lastActive: "invited" } };
});
