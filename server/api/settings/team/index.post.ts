import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
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

  const member = await db
    .insert(teamMembers)
    .values({
      name: name.trim(),
      email: email || null,
      initials: initials || name.trim().slice(0, 2).toUpperCase(),
      role: role || "viewer",
      lastActive: lastActive || "just now",
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: member };
});
