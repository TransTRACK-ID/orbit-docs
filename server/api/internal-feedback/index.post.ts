import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { internalAppFeedback } from "~/server/database/schema";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { requireTeamAccess } from "~/server/utils/team-access";

const VALID_CATEGORIES = new Set(["general", "bug", "feature", "docs"]);

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  await requireTeamAccess(event, "viewer");

  const body = await readBody(event);
  const category = typeof body?.category === "string" ? body.category : "general";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  if (!VALID_CATEGORIES.has(category)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid category",
    });
  }

  if (!comment) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Comment is required",
    });
  }

  const db = getDb();
  const feedback = await db
    .insert(internalAppFeedback)
    .values({
      userId: user.id || null,
      userName: getActorName(user),
      userEmail: user.email || null,
      category: category as "general" | "bug" | "feature" | "docs",
      comment: comment.slice(0, 2000),
      status: "open",
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: feedback };
});
