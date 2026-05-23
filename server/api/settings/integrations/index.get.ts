import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { integrationSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  const rows = await db.select().from(integrationSettings).limit(1);
  const row = rows[0];

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Integration settings not found",
    });
  }

  return { data: row };
});
