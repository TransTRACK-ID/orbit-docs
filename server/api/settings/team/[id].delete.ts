import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireTeamAccess, getCurrentMember } from "~/server/utils/team-access";
import { loadRoles } from "~/server/utils/roles";
import { roleLevel } from "~/server/lib/permissions";

export default defineEventHandler(async (event) => {
  await requireTeamAccess(event, "product_manager");
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Member ID is required",
    });
  }

  // Prevent managers from deleting themselves or higher-ranked members
  const currentMember = await getCurrentMember(event);
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

  if (currentMember) {
    const allRoles = await loadRoles();
    const currentLevel = roleLevel(allRoles, currentMember.role);
    const targetLevel = roleLevel(allRoles, targetMember.role);

    if (currentMember.id === targetMember.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "You cannot remove yourself from the team.",
      });
    }

    if (targetLevel > currentLevel) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "You cannot remove a team member with a higher role.",
      });
    }
  }

  // Prevent removing the last active admin
  if (targetMember.role === "admin" && targetMember.status === "active") {
    const adminCount = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.role, "admin"), eq(teamMembers.status, "active")))
      .then((rows) => rows.length);

    if (adminCount <= 1) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "Cannot remove the last admin. Promote another member first.",
      });
    }
  }

  const deleted = await db
    .delete(teamMembers)
    .where(eq(teamMembers.id, id))
    .returning()
    .then((rows) => rows[0]);

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Team member not found",
    });
  }

  return { success: true };
});
