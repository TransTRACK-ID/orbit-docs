import { defineEventHandler, readBody, createError } from "h3";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "~/server/database";
import { activityLogs, docs } from "~/server/database/schema";
import { requireAuth, getActorName } from "~/server/utils/auth";

const VALID_STATUSES = ["draft", "in_review", "published", "archived"] as const;
type DocStatus = (typeof VALID_STATUSES)[number];

const MAX_IDS = 500;

function isKnowledgeDoc(row: { source: string | null; docType: string | null }) {
  return row.source === "op_sync" && row.docType === "feature";
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string" && id.trim()) : [];
  const status = body?.status as DocStatus | undefined;

  if (!ids.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "At least one doc id is required",
    });
  }

  if (ids.length > MAX_IDS) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `At most ${MAX_IDS} docs can be updated at once`,
    });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const uniqueIds = [...new Set(ids as string[])];
  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      source: docs.source,
      docType: docs.docType,
      appId: docs.appId,
    })
    .from(docs)
    .where(inArray(docs.id, uniqueIds));

  const knowledgeIds = rows.filter(isKnowledgeDoc).map((r) => r.id);
  const skipped = uniqueIds.length - knowledgeIds.length;

  if (!knowledgeIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "None of the selected docs are Knowledge base features",
    });
  }

  const updatedAt = new Date();
  await db
    .update(docs)
    .set({ status, updatedAt })
    .where(
      and(
        inArray(docs.id, knowledgeIds),
        eq(docs.source, "op_sync"),
        eq(docs.docType, "feature"),
      ),
    );

  await db.insert(activityLogs).values({
    appId: rows.find((r) => knowledgeIds.includes(r.id))?.appId ?? null,
    appName: `${knowledgeIds.length} knowledge docs`,
    action: `Bulk status → ${status}`,
    actor: getActorName(user),
  });

  return {
    data: {
      status,
      updated: knowledgeIds.length,
      skipped,
      ids: knowledgeIds,
      updatedAt: updatedAt.toISOString(),
    },
  };
});
