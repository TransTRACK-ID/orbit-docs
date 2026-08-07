import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import { requireTeamAccess, formatLastActive, type TeamRole } from "~/server/utils/team-access";
import { requireSuperAdmin } from "~/server/utils/rbac";

const VALID_TEAM_ROLES: TeamRole[] = ["admin", "product_manager", "tech_writer", "viewer"];

export default defineEventHandler(async (event) => {
  await requireAuth(event);
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

  const body = await readBody(event);
  const { name, email, initials, role, status, lastActive } = body || {};

  // Role changes are super-admin only
  if (role !== undefined && role !== existing.role) {
    if (!VALID_TEAM_ROLES.includes(role as TeamRole)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Invalid team role.",
      });
    }
    await requireSuperAdmin(event);
  } else {
    await requireTeamAccess(event, "product_manager");
  }

  const updateData: Partial<typeof teamMembers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email ? email.trim() : null;
  if (initials !== undefined) updateData.initials = initials.trim();
  if (role !== undefined) updateData.role = role;
  if (status !== undefined) updateData.status = status;
  if (lastActive !== undefined) updateData.lastActive = lastActive;

  const updated = await db
    .update(teamMembers)
    .set(updateData)
    .where(eq(teamMembers.id, id))
    .returning()
    .then((rows) => rows[0]);

  return { data: { ...updated, lastActive: formatLastActive(updated.lastActiveAt) } };
});
