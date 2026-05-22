import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { owners } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const { name, email, role } = body || {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Owner name is required",
    });
  }

  const owner = await db
    .insert(owners)
    .values({
      name: name.trim(),
      email: email || null,
      role: role || null,
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: owner };
});
