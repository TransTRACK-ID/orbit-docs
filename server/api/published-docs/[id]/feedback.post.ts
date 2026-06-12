import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docFeedback } from "~/server/database/schema";
import { findExistingVisitorFeedback, getPublishedDocForFeedback } from "~/server/utils/feedback";

export default defineEventHandler(async (event) => {
  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const body = await readBody(event);
  const { helpful, comment, visitorId } = body || {};

  if (typeof helpful !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "helpful must be a boolean",
    });
  }

  const trimmedComment =
    typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 2000) : null;
  const trimmedVisitorId =
    typeof visitorId === "string" && visitorId.trim() ? visitorId.trim().slice(0, 128) : null;

  const doc = await getPublishedDocForFeedback(docId);

  if (trimmedVisitorId) {
    const existing = await findExistingVisitorFeedback(docId, trimmedVisitorId);
    if (existing) {
      return { data: existing, alreadySubmitted: true };
    }
  }

  const db = getDb();
  const feedback = await db
    .insert(docFeedback)
    .values({
      docId,
      appId: doc.appId,
      helpful,
      comment: trimmedComment,
      visitorId: trimmedVisitorId,
      status: "open",
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: feedback };
});
