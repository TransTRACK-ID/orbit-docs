import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docFeedback } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Feedback ID is required",
    });
  }

  const db = getDb();
  const deleted = await db
    .delete(docFeedback)
    .where(eq(docFeedback.id, id))
    .returning({ id: docFeedback.id })
    .then((rows) => rows[0]);

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Feedback not found",
    });
  }

  return { success: true };
});
