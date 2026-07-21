import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docs, activityLogs, docVersions } from "~/server/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { parseFrontmatter } from "~/composables/useMarkdown";

const VALID_STATUSES = ["draft", "in_review", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const { title, appId, content, status, versionId, tags, author, source, docType, siteId, slug, sortOrder } = body || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc title is required",
    });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Tags must be an array of strings",
    });
  }

  const docSource = source || "manual";
  const docTypeValue = docType || null;

  // ── Upsert for generated docs: find existing by appId + docType + source ──
  if (docSource === "generated" && appId && docTypeValue) {
    const existing = await db
      .select()
      .from(docs)
      .where(
        and(
          eq(docs.appId, appId),
          eq(docs.docType, docTypeValue),
          eq(docs.source, "generated")
        )
      )
      .limit(1)
      .then((rows) => rows[0] || null);

    if (existing) {
      // Auto-save version before update
      const existingVersions = await db
        .select()
        .from(docVersions)
        .where(eq(docVersions.docId, existing.id))
        .orderBy(desc(docVersions.createdAt));

      const nextVersionNum = existingVersions.length + 1;
      await db.insert(docVersions).values({
        docId: existing.id,
        version: `v${nextVersionNum}`,
        content: existing.content || "",
        title: existing.title,
        actor: getActorName(user),
      });

      // Update the existing doc
      const updated = await db
        .update(docs)
        .set({
          title: title.trim(),
          content: content || "",
          status: status || existing.status,
          versionId: versionId || existing.versionId,
          tags: Array.isArray(tags)
            ? tags.filter((t: string) => typeof t === "string" && t.trim() !== "").map((t: string) => t.trim())
            : existing.tags,
          updatedAt: new Date(),
        })
        .where(eq(docs.id, existing.id))
        .returning()
        .then((rows) => rows[0]);

      await db.insert(activityLogs).values({
        appId: updated.appId,
        appName: updated.title,
        action: "Generated doc updated",
        actor: updated.author || getActorName(user),
      });

      return { data: updated };
    }
  }

  // ── Create new doc ──────────────────────────────────────────────────────
  const doc = await db
    .insert(docs)
    .values({
      title: title.trim(),
      appId: appId || null,
      content: content || "",
      frontmatter: parseFrontmatter(content || "").frontmatter,
      status: status || "draft",
      versionId: versionId || null,
      tags: Array.isArray(tags) ? tags.filter((t: string) => typeof t === "string" && t.trim() !== "").map((t: string) => t.trim()) : [],
      author: author || getActorName(user),
      source: docSource,
      docType: docTypeValue,
      siteId: siteId || null,
      slug: slug ? String(slug).trim() : null,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) || 0 : 0,
    })
    .returning()
    .then((rows) => rows[0]);

  // Create initial version
  await db.insert(docVersions).values({
    docId: doc.id,
    version: "v1",
    content: doc.content || "",
    title: doc.title,
    actor: getActorName(user),
  });

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "Doc created",
    actor: doc.author || getActorName(user),
  });

  return { data: doc };
});
