import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docEmbeds, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

const VALID_STATUSES = ["draft", "published", "archived"] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const { title, appId, versionId, subtitle, navItems, content, status, author } = body || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Embed doc title is required",
    });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  // Ensure unique slug
  while (true) {
    const existing = await db
      .select({ id: docEmbeds.id })
      .from(docEmbeds)
      .where(eq(docEmbeds.slug, slug))
      .limit(1);
    if (existing.length === 0) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const doc = await db
    .insert(docEmbeds)
    .values({
      title: title.trim(),
      slug,
      appId: appId || null,
      versionId: versionId || null,
      subtitle: subtitle || null,
      navItems: Array.isArray(navItems) ? navItems : [],
      content: content || "",
      status: status || "draft",
      author: author || getActorName(user),
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "Embed doc created",
    actor: doc.author || getActorName(user),
  });

  return { data: doc };
});
