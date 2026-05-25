import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireTeamAccess, getCurrentMember, type TeamRole } from "~/server/utils/team-access";

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

  const existing = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Team member not found",
    });
  }

  // Prevent self-deletion
  const currentMember = await getCurrentMember(event);
  if (currentMember && currentMember.id === id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You cannot remove yourself from the workspace.",
    });
  }

  // Prevent removing the last admin
  if (existing.role === "admin") {
    const adminCount = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.role, "admin"))
      .then((rows) => rows.length);

    if (adminCount <= 1) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "Cannot remove the last admin. Promote another member first.",
      });
    }
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, id));

  return { data: { id, deleted: true } };
});
