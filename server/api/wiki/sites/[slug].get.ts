import { defineEventHandler, getRouterParam, createError } from "h3";
import { requirePermission } from "~/server/utils/rbac";
import {
  canReadDraftDocs,
  loadWikiSiteBySlug,
  loadWikiSitePages,
} from "~/server/lib/wiki-site-queries";

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, "doc_sites:read");
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Site slug is required",
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
  const pageRows = await loadWikiSitePages(site.id, includeDrafts);

  return {
    data: {
      id: site.id,
      appId: site.appId,
      name: site.name,
      slug: site.slug,
      description: site.description,
      status: site.status,
      navConfig: site.navConfig,
      openapiNormalized: site.openapiNormalized,
      updatedAt: site.updatedAt,
      app: site.appName ? { id: site.appId, name: site.appName } : null,
      pages: pageRows,
    },
  };
});
