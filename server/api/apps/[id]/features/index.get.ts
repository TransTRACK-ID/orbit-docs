import { defineEventHandler, createError, getRouterParam, getQuery } from "h3";
import { and, eq, sql, desc } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps, docs } from "~/server/database/schema";
import { requireApiKey } from "~/server/utils/api-key-auth";
import { moduleTag, parseModuleFromTags } from "~/server/lib/feature-docs";

export default defineEventHandler(async (event) => {
  await requireApiKey(event);

  const appId = getRouterParam(event, "id");
  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const query = getQuery(event);
  const moduleFilter = typeof query.module === "string" ? query.module.trim() : "";
  const statusFilter = typeof query.status === "string" ? query.status.trim() : "";
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const db = getDb();
  const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.id, appId)).limit(1);
  if (!app[0]) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "App not found" });
  }

  const conditions = [
    eq(docs.appId, appId),
    eq(docs.docType, "feature"),
    eq(docs.source, "op_sync"),
  ];

  if (moduleFilter) {
    conditions.push(sql`${docs.tags} @> ARRAY[${moduleTag(moduleFilter)}]::text[]`);
  }

  if (statusFilter) {
    conditions.push(eq(docs.status, statusFilter as "draft" | "in_review" | "published" | "archived"));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(
        ${docs.title} ILIKE ${pattern}
        OR ${docs.externalId} ILIKE ${pattern}
        OR ${docs.content} ILIKE ${pattern}
      )`,
    );
  }

  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: docs.id,
        title: docs.title,
        status: docs.status,
        externalId: docs.externalId,
        tags: docs.tags,
        updatedAt: docs.updatedAt,
        author: docs.author,
      })
      .from(docs)
      .where(whereClause)
      .orderBy(desc(docs.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(docs)
      .where(whereClause),
  ]);

  const data = rows.map((row) => ({
    feature_id: row.externalId,
    docId: row.id,
    module: parseModuleFromTags(row.tags),
    feature_name: row.title,
    status: row.status,
    author: row.author,
    publicUrl: `/p/${row.id}`,
    updatedAt: row.updatedAt,
  }));

  return {
    data,
    meta: {
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    },
  };
});
