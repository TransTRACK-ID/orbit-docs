import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getAuthUser } from "~/server/utils/auth";

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

  const member = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!member) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Invitation not found",
    });
  }

  if (member.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This invitation has already been accepted or is no longer pending.",
    });
  }

  // Verify the current user's email matches the invited email
  if (member.email !== user.email) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "This invitation is not addressed to you.",
    });
  }

  const now = new Date();
  const updated = await db
    .update(teamMembers)
    .set({
      status: "active",
      userId: user.id,
      lastActive: "just now",
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(teamMembers.id, id))
    .returning()
    .then((rows) => rows[0]);

  return { data: { ...updated, lastActive: "just now" } };
});
