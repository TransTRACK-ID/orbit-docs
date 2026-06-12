import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
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

  const query = getQuery(event);
  const visitorId = typeof query.visitorId === "string" ? query.visitorId.trim() : "";

  if (!visitorId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "visitorId is required",
    });
  }

  await getPublishedDocForFeedback(docId);
  const existing = await findExistingVisitorFeedback(docId, visitorId.slice(0, 128));

  return {
    data: {
      submitted: !!existing,
      feedback: existing,
    },
  };
});
