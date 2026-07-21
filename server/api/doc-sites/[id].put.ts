import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, activityLogs, docs } from "~/server/database/schema";
import { eq, ne, and } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { isValidSiteSlug, slugify, normaliseNavConfig, collectReferencedSlugs } from "~/server/lib/nav-config";

const VALID_STATUSES = ["draft", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site ID is required" });
  }

  const existing = await db.select().from(docSites).where(eq(docSites.id, id)).limit(1).then((r) => r[0] || null);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  const body = await readBody(event);
  const { name, slug, description, appId, status, navConfig, clearOpenApi } = body || {};

  const updateData: Partial<typeof docSites.$inferInsert> = { updatedAt: new Date() };

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site name cannot be empty" });
    }
    updateData.name = name.trim();
  }

  if (slug !== undefined) {
    const finalSlug = slugify(typeof slug === "string" ? slug : "");
    if (!isValidSiteSlug(finalSlug)) {
      throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Invalid slug. Use lowercase letters, numbers, and hyphens." });
    }
    if (finalSlug !== existing.slug) {
      const clash = await db
        .select()
        .from(docSites)
        .where(and(eq(docSites.slug, finalSlug), ne(docSites.id, id)))
        .limit(1)
        .then((r) => r[0] || null);
      if (clash) {
        throw createError({ statusCode: 409, statusMessage: "Conflict", message: "A site with that slug already exists" });
      }
    }
    updateData.slug = finalSlug;
  }

  if (description !== undefined) {
    updateData.description = typeof description === "string" ? description : null;
  }

  if (appId !== undefined) {
    updateData.appId = appId || null;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      throw createError({ statusCode: 400, statusMessage: "Bad Request", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    updateData.status = status;
  }

  if (navConfig !== undefined) {
    const normalised = normaliseNavConfig(navConfig);
    if (clearOpenApi === true) {
      normalised.openapi = [];
    }
    updateData.navConfig = normalised;
    // Warn (not block) about referenced slugs that don't exist in the site.
    const referenced = collectReferencedSlugs(normalised);
    if (referenced.length > 0) {
      const sitePages = await db
        .select({ slug: docs.slug })
        .from(docs)
        .where(eq(docs.siteId, id));
      const existingSlugs = new Set(sitePages.map((p) => p.slug).filter(Boolean));
      const missing = referenced.filter((s) => !existingSlugs.has(s));
      if (missing.length > 0) {
        console.warn(`[doc-sites] nav references missing slugs: ${missing.join(", ")}`);
      }
    }
  }

  // Clearing the textarea alone does not remove API reference; this flag does.
  if (clearOpenApi === true) {
    updateData.openapiSpec = null;
    updateData.openapiFormat = null;
    updateData.openapiNormalized = null;
    if (navConfig === undefined) {
      const existingNav = normaliseNavConfig(existing.navConfig);
      existingNav.openapi = [];
      updateData.navConfig = existingNav;
    }
  }

  const updated = await db.update(docSites).set(updateData).where(eq(docSites.id, id)).returning().then((r) => r[0]);

  await db.insert(activityLogs).values({
    appId: updated.appId,
    appName: updated.name,
    action: "Doc site updated",
    actor: getActorName(user),
  });

  return { data: updated };
});
