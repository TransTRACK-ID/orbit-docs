import type { NavConfig, NormalizedOpenApi } from "~/server/database/schema";

export interface PublicSitePage {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  updatedAt: string | null;
}

export interface PublicSite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  navConfig: NavConfig | null;
  openapiNormalized: NormalizedOpenApi | null;
  app: { id: string; name: string } | null;
  pages: PublicSitePage[];
}

export interface PublicSitePageDetail {
  id: string;
  title: string;
  content: string | null;
  slug: string;
  frontmatter: Record<string, unknown> | null;
  author: string | null;
  updatedAt: string | null;
  site: {
    id: string;
    name: string;
    slug: string;
    navConfig: NavConfig | null;
    openapiNormalized?: NormalizedOpenApi | null;
    app: { id: string; name: string } | null;
    pages: Array<{ id: string; title: string; slug: string | null }>;
  };
}

export const usePublicSite = () => {
  async function fetchSite(slug: string): Promise<PublicSite> {
    const res = await $fetch<{ data: PublicSite }>(`/api/public/sites/${slug}`);
    return res.data;
  }

  async function fetchPage(siteSlug: string, pageSlug: string): Promise<PublicSitePageDetail> {
    const res = await $fetch<{ data: PublicSitePageDetail }>(
      `/api/public/sites/${siteSlug}/${pageSlug}`,
    );
    return res.data;
  }

  return { fetchSite, fetchPage };
};
