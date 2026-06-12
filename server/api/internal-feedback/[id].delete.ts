import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { internalAppFeedback } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdminAccess } from "~/server/utils/team-access";

export default defineEventHandler(async (event) => {
  await requireSuperAdminAccess(event);
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
    .delete(internalAppFeedback)
    .where(eq(internalAppFeedback.id, id))
    .returning({ id: internalAppFeedback.id })
    .then((rows) => rows[0]);

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Feedback not found",
    });
  }

  return { data: { id: deleted.id } };
});
