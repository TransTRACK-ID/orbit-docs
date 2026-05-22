import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { owners } from "~/server/database/schema";
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
      message: "Owner ID is required",
    });
  }

  const body = await readBody(event);
  const { name, email, role } = body || {};

  const updateData: Partial<typeof owners.$inferInsert> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email || null;
  if (role !== undefined) updateData.role = role || null;
  updateData.updatedAt = new Date();

  const owner = await db
    .update(owners)
    .set(updateData)
    .where(eq(owners.id, id))
    .returning()
    .then((rows) => rows[0]);

  if (!owner) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Owner not found",
    });
  }

  return { data: owner };
});
