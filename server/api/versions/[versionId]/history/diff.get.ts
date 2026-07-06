import { defineEventHandler, getRouterParam, getQuery, createError } from "h3";
import { getDb } from "~/server/database";
import { versionHistory } from "~/server/database/schema";
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
  const versionId = getRouterParam(event, "versionId");
  const query = getQuery(event);
  let fromId = String(query.from || "");
  let toId = String(query.to || "");

  if (!versionId) {
    throw createError({ statusCode: 400, message: "versionId is required" });
  }

  const versions = await db
    .select()
    .from(versionHistory)
    .where(eq(versionHistory.versionId, versionId))
    .orderBy(desc(versionHistory.createdAt));

  if (versions.length === 0) {
    throw createError({ statusCode: 404, message: "No history found for this version" });
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
      { key: "content", label: "Content", from: from.content, to: to.content },
    ]),
    metadata: [],
  }));

  return { data: response };
});
