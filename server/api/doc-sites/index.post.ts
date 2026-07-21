import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { isValidSiteSlug, slugify, normaliseNavConfig } from "~/server/lib/nav-config";

const VALID_STATUSES = ["draft", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);
  const { name, slug, description, appId, status, navConfig } = body || {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site name is required" });
  }

  const finalSlug = slugify(typeof slug === "string" && slug.trim() ? slug : name);
  if (!isValidSiteSlug(finalSlug)) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Invalid slug. Use lowercase letters, numbers, and hyphens." });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const existing = await db.select().from(docSites).where(eq(docSites.slug, finalSlug)).limit(1).then((r) => r[0] || null);
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "A site with that slug already exists" });
  }

  const created = await db
    .insert(docSites)
    .values({
      name: name.trim(),
      slug: finalSlug,
      description: typeof description === "string" ? description : null,
      appId: appId || null,
      status: status || "draft",
      navConfig: normaliseNavConfig(navConfig),
    })
    .returning()
    .then((r) => r[0]);

  await db.insert(activityLogs).values({
    appId: created.appId,
    appName: created.name,
    action: "Doc site created",
    actor: getActorName(user),
  });

  return { data: created };
});
