import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { internalAppFeedback } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdminAccess } from "~/server/utils/team-access";

const VALID_STATUSES = new Set(["open", "resolved", "closed"]);

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

  const body = await readBody(event);
  const { status } = body || {};

  if (!status || !VALID_STATUSES.has(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Valid status is required (open, resolved, closed)",
    });
  }

  const db = getDb();
  const updated = await db
    .update(internalAppFeedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(internalAppFeedback.id, id))
    .returning()
    .then((rows) => rows[0]);

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Feedback not found",
    });
  }

  return { data: updated };
});
