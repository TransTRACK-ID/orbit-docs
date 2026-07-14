import { defineEventHandler, createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps, docs } from "~/server/database/schema";
import { requireApiKey } from "~/server/utils/api-key-auth";
import { parseModuleFromTags } from "~/server/lib/feature-docs";

export default defineEventHandler(async (event) => {
  await requireApiKey(event);

  const appId = getRouterParam(event, "id");
  const featureId = getRouterParam(event, "featureId");

  if (!appId || !featureId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and feature ID are required",
    });
  }

  const db = getDb();
  const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.id, appId)).limit(1);
  if (!app[0]) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "App not found" });
  }

  const row = await db
    .select()
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        eq(docs.externalId, featureId),
        eq(docs.docType, "feature"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Feature not found",
    });
  }

  return {
    data: {
      feature_id: row.externalId,
      docId: row.id,
      module: parseModuleFromTags(row.tags),
      feature_name: row.title,
      status: row.status,
      author: row.author,
      content: row.content,
      tags: row.tags,
      publicUrl: `/p/${row.id}`,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  };
});
