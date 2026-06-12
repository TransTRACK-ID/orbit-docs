import { createError } from "h3";
import { getDb } from "~/server/database";
import { docs, docFeedback } from "~/server/database/schema";
import { and, eq } from "drizzle-orm";

export async function getPublishedDocForFeedback(docId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: docs.id,
      appId: docs.appId,
      title: docs.title,
      status: docs.status,
    })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  if (doc.status !== "published") {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Feedback is only available for published docs",
    });
  }

  return doc;
}

export async function findExistingVisitorFeedback(docId: string, visitorId: string) {
  const db = getDb();
  return db
    .select({
      id: docFeedback.id,
      helpful: docFeedback.helpful,
      comment: docFeedback.comment,
      createdAt: docFeedback.createdAt,
    })
    .from(docFeedback)
    .where(and(eq(docFeedback.docId, docId), eq(docFeedback.visitorId, visitorId)))
    .limit(1)
    .then((rows) => rows[0] || null);
}
