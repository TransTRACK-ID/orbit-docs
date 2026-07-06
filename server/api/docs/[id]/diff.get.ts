import { defineEventHandler, getRouterParam, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { docs, docVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import {
  buildHistoryDiffResponse,
  buildTextSections,
  resolveDefaultFromId,
} from "~/server/lib/history-diff";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  let fromId = String(query.from || "");
  let toId = String(query.to || "");

  if (!id) {
    throw createError({ statusCode: 400, message: "Doc ID is required" });
  }

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({ statusCode: 404, message: "Doc not found" });
  }

  const versions = await db
    .select()
    .from(docVersions)
    .where(eq(docVersions.docId, id))
    .orderBy(desc(docVersions.createdAt));

  if (versions.length === 0) {
    throw createError({ statusCode: 404, message: "No versions found for this doc" });
  }

  if (!toId) {
    toId = versions[0].id;
  }

  if (!fromId) {
    const defaultFrom = resolveDefaultFromId(versions, toId);
    if (!defaultFrom) {
      throw createError({ statusCode: 400, message: "Unable to resolve comparison baseline" });
    }
    fromId = defaultFrom;
  }

  if (fromId === toId) {
    throw createError({ statusCode: 400, message: "Select two different versions to compare" });
  }

  const response = buildHistoryDiffResponse(versions, fromId, toId, (from, to) => ({
    sections: buildTextSections([
      { key: "title", label: "Title", from: from.title, to: to.title },
      { key: "content", label: "Content", from: from.content, to: to.content },
    ]),
    metadata: [],
  }));

  return { data: response };
});
