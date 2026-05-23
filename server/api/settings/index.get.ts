import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { workspaceSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  const rows = await db.select().from(workspaceSettings).limit(1);
  const row = rows[0];

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Workspace settings not found",
    });
  }

  return { data: row };
});
