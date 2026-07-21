import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, docs, apps, workspaceSettings } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const slug = getRouterParam(event, "slug");
  const pageSlug = getRouterParam(event, "pageSlug");

  if (!slug || !pageSlug) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site slug and page slug are required" });
  }

  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const isPublic = settingsRows[0]?.publicDocsAccess ?? true;
  if (!isPublic) {
    await requireAuth(event);
  }

  const siteRows = await db
    .select({
      id: docSites.id,
      name: docSites.name,
      slug: docSites.slug,
      status: docSites.status,
      navConfig: docSites.navConfig,
      openapiNormalized: docSites.openapiNormalized,
      appId: docSites.appId,
      appName: apps.name,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(eq(docSites.slug, slug))
    .limit(1);

  const site = siteRows[0];
  if (!site || site.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  const pageRows = await db
    .select({
      id: docs.id,
      title: docs.title,
      content: docs.content,
      slug: docs.slug,
      status: docs.status,
      frontmatter: docs.frontmatter,
      author: docs.author,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(and(eq(docs.siteId, site.id), eq(docs.slug, pageSlug)))
    .limit(1);

  const page = pageRows[0];
  if (!page || page.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Page not found" });
  }

  const sitePages = await db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
    })
    .from(docs)
    .where(and(eq(docs.siteId, site.id), eq(docs.status, "published")));

  return {
    data: {
      id: page.id,
      title: page.title,
      content: page.content,
      slug: page.slug,
      frontmatter: page.frontmatter,
      author: page.author,
      updatedAt: page.updatedAt,
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        navConfig: site.navConfig,
        openapiNormalized: site.openapiNormalized,
        app: site.appName ? { id: site.appId, name: site.appName } : null,
        pages: sitePages,
      },
    },
  };
});
