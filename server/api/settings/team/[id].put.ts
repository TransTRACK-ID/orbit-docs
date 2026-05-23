import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

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

  const body = await readBody(event);
  const { name, email, initials, role, lastActive } = body || {};

  const updateData: Partial<typeof teamMembers.$inferInsert> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email || null;
  if (initials !== undefined) updateData.initials = initials;
  if (role !== undefined) updateData.role = role;
  if (lastActive !== undefined) updateData.lastActive = lastActive;
  updateData.updatedAt = new Date();

  const member = await db
    .update(teamMembers)
    .set(updateData)
    .where(eq(teamMembers.id, id))
    .returning()
    .then((rows) => rows[0]);

  if (!member) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Team member not found",
    });
  }

  return { data: member };
});
