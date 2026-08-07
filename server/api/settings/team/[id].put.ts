import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getAuthUser } from "~/server/utils/auth";
import { getCurrentMember, canManageMembers, formatLastActive, type TeamRole } from "~/server/utils/team-access";
import { requireSuperAdmin } from "~/server/utils/rbac";

const VALID_TEAM_ROLES: TeamRole[] = ["admin", "product_manager", "tech_writer", "viewer"];

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Member ID is required",
    });
  }

  const body = await readBody(event);
  const { name, email, initials, role, lastActive, status } = body || {};

  // Find the target member
  const targetMember = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!targetMember) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Team member not found",
    });
  }

  // Special case: self-acceptance of a pending invitation
  const isAcceptingInvitation =
    status === "active" && targetMember.status === "pending" && targetMember.email === user.email;

  if (isAcceptingInvitation) {
    const updateData: Partial<typeof teamMembers.$inferInsert> = {
      status: "active",
      userId: user.id,
      lastActive: "just now",
      updatedAt: new Date(),
    };
    if (name !== undefined) updateData.name = name.trim();
    if (initials !== undefined) updateData.initials = initials;

    const updated = await db
      .update(teamMembers)
      .set(updateData)
      .where(eq(teamMembers.id, id))
      .returning()
      .then((rows) => rows[0]);

    return { data: updated };
  }

  // For all other updates, require management access (role changes require super admin)
  const isRoleChange = role !== undefined && role !== targetMember.role;

  if (isRoleChange) {
    if (!VALID_TEAM_ROLES.includes(role as TeamRole)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Invalid team role.",
      });
    }
    await requireSuperAdmin(event);
  } else {
    const currentMember = await getCurrentMember(event);
    if (!currentMember || !canManageMembers(currentMember.role as TeamRole)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "You do not have permission to update team members.",
      });
    }
  }

  const updateData: Partial<typeof teamMembers.$inferInsert> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email || null;
  if (initials !== undefined) updateData.initials = initials;
  if (role !== undefined) updateData.role = role;
  if (lastActive !== undefined) updateData.lastActive = lastActive;
  if (status !== undefined) updateData.status = status;
  updateData.updatedAt = new Date();

  const member = await db
    .update(teamMembers)
    .set(updateData)
    .where(eq(teamMembers.id, id))
    .returning()
    .then((rows) => rows[0]);

  return { data: { ...member, lastActive: formatLastActive(member.lastActiveAt) } };
});
