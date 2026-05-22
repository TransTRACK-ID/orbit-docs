import { defineEventHandler, createError, getRouterParam } from "h3";
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

  const existing = await db
    .select()
    .from(owners)
    .where(eq(owners.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Owner not found",
    });
  }

  await db.delete(owners).where(eq(owners.id, id));

  return { data: { id, deleted: true } };
});
