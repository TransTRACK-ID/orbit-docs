import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, activityLogs, apps, appVersions, docSites } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { createDocVersionSnapshot, isValidDocVersionAction } from "~/server/lib/doc-version-snapshot";
import { parseFrontmatter } from "~/composables/useMarkdown";

const VALID_STATUSES = ["draft", "in_review", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const body = await readBody(event);
  const { title, appId, content, status, versionId, tags, author, source, docType, versionAction, siteId, slug, sortOrder, frontmatter } = body || {};

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  // Validate status if provided
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Validate tags if provided
  if (tags !== undefined && !Array.isArray(tags)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Tags must be an array of strings",
    });
  }
  if (tags !== undefined && tags.length > 0 && tags.some((t: unknown) => typeof t !== "string")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "All tags must be strings",
    });
  }

  // Snapshot only on explicit save/publish/restore — not autosave.
  if (isValidDocVersionAction(versionAction)) {
    await createDocVersionSnapshot(
      db,
      id,
      { title: existing.title, content: existing.content },
      getActorName(user),
      versionAction,
    );
  }

  const updateData: Partial<typeof docs.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (title !== undefined) updateData.title = title.trim();
  if (appId !== undefined) updateData.appId = appId || null;
  if (content !== undefined) {
    updateData.content = content || "";
    const parsed = parseFrontmatter(content || "");
    updateData.frontmatter = parsed.frontmatter;
  }
  if (frontmatter !== undefined) {
    updateData.frontmatter =
      frontmatter && typeof frontmatter === "object" ? frontmatter : {};
  }
  if (status !== undefined) updateData.status = status;
  if (versionId !== undefined) updateData.versionId = versionId || null;
  if (tags !== undefined) updateData.tags = tags.filter((t: string) => t.trim() !== "").map((t: string) => t.trim());
  if (author !== undefined) updateData.author = author || null;
  if (source !== undefined) updateData.source = source;
  if (docType !== undefined) updateData.docType = docType || null;
  if (siteId !== undefined) updateData.siteId = siteId || null;
  if (slug !== undefined) updateData.slug = slug ? slug.trim() : null;
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;

  const updatedRow = await db
    .update(docs)
    .set(updateData)
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  // Fetch joined data to return consistent shape with GET
  const enrichedRows = await db
    .select({
      id: docs.id,
      appId: docs.appId,
      title: docs.title,
      content: docs.content,
      status: docs.status,
      versionId: docs.versionId,
      tags: docs.tags,
      author: docs.author,
      createdAt: docs.createdAt,
      updatedAt: docs.updatedAt,
      appName: apps.name,
      version: appVersions.version,
    })
    .from(docs)
    .leftJoin(apps, eq(docs.appId, apps.id))
    .leftJoin(appVersions, eq(docs.versionId, appVersions.id))
    .where(eq(docs.id, id))
    .limit(1);

  const enriched = enrichedRows[0];

  const allVersions = enriched.appId
    ? await db
        .select({ id: appVersions.id, version: appVersions.version, status: appVersions.status })
        .from(appVersions)
        .where(eq(appVersions.appId, enriched.appId))
        .orderBy(desc(appVersions.createdAt))
    : [];

  await db.insert(activityLogs).values({
    appId: updatedRow.appId,
    appName: updatedRow.title,
    action: "Doc updated",
    actor: updatedRow.author || getActorName(user),
  });

  return {
    data: {
      ...updatedRow,
      app: enriched.appName ? { id: enriched.appId, name: enriched.appName } : null,
      version: enriched.version ? { id: enriched.versionId, version: enriched.version } : null,
      appVersions: allVersions,
    },
  };
});
