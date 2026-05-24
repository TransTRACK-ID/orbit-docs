import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, activityLogs, apps, appVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

const VALID_STATUSES = ["draft", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Embed doc ID is required",
    });
  }

  const body = await readBody(event);
  const { title, appId, versionId, subtitle, navItems, content, status, author, slug } = body || {};

  const existing = await db
    .select()
    .from(docEmbeds)
    .where(eq(docEmbeds.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Embed doc not found",
    });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Validate unique slug if changing
  if (slug !== undefined && slug !== existing.slug) {
    const dup = await db
      .select({ id: docEmbeds.id })
      .from(docEmbeds)
      .where(eq(docEmbeds.slug, slug))
      .limit(1);
    if (dup.length > 0 && dup[0].id !== id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Slug already in use",
      });
    }
  }

  const updateData: Partial<typeof docEmbeds.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (title !== undefined) updateData.title = title.trim();
  if (slug !== undefined) updateData.slug = slug.trim();
  if (appId !== undefined) updateData.appId = appId || null;
  if (versionId !== undefined) updateData.versionId = versionId || null;
  if (subtitle !== undefined) updateData.subtitle = subtitle || null;
  if (navItems !== undefined) updateData.navItems = Array.isArray(navItems) ? navItems : [];
  if (content !== undefined) updateData.content = content || "";
  if (status !== undefined) updateData.status = status;
  if (author !== undefined) updateData.author = author || null;

  const updatedRow = await db
    .update(docEmbeds)
    .set(updateData)
    .where(eq(docEmbeds.id, id))
    .returning()
    .then((rows) => rows[0]);

  // Fetch joined data for consistent return shape
  const enrichedRows = await db
    .select({
      id: docEmbeds.id,
      appId: docEmbeds.appId,
      versionId: docEmbeds.versionId,
      title: docEmbeds.title,
      slug: docEmbeds.slug,
      subtitle: docEmbeds.subtitle,
      navItems: docEmbeds.navItems,
      content: docEmbeds.content,
      status: docEmbeds.status,
      author: docEmbeds.author,
      createdAt: docEmbeds.createdAt,
      updatedAt: docEmbeds.updatedAt,
      appName: apps.name,
      version: appVersions.version,
    })
    .from(docEmbeds)
    .leftJoin(apps, eq(docEmbeds.appId, apps.id))
    .leftJoin(appVersions, eq(docEmbeds.versionId, appVersions.id))
    .where(eq(docEmbeds.id, id))
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
    action: "Embed doc updated",
    actor: getActorName(user),
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
