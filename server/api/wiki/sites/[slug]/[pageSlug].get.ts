import { defineEventHandler, getRouterParam, createError } from "h3";
import { requirePermission } from "~/server/utils/rbac";
import {
  canReadDraftDocs,
  loadWikiSiteBySlug,
  loadWikiSitePages,
  loadWikiPage,
} from "~/server/lib/wiki-site-queries";

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, "doc_sites:read");
  const slug = getRouterParam(event, "slug");
  const pageSlug = getRouterParam(event, "pageSlug");

  if (!slug || !pageSlug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Site slug and page slug are required",
    });
  }

  const site = await loadWikiSiteBySlug(slug);
  if (!site) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc site not found",
    });
  }

  const includeDrafts = canReadDraftDocs(context);
  const page = await loadWikiPage(site.id, pageSlug, includeDrafts);
  if (!page) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Page not found",
    });
  }

  const sitePages = await loadWikiSitePages(site.id, includeDrafts);

  return {
    data: {
      id: page.id,
      title: page.title,
      content: page.content,
      slug: page.slug,
      status: page.status,
      frontmatter: page.frontmatter,
      author: page.author,
      updatedAt: page.updatedAt,
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        navConfig: site.navConfig,
        openapiNormalized: site.openapiNormalized,
        app: site.appName ? { id: site.appId, name: site.appName } : null,
        pages: sitePages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
        })),
      },
    },
  };
});
