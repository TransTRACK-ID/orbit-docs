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

const pageCache = new Map<string, PublicSitePageDetail>();
const pageInflight = new Map<string, Promise<PublicSitePageDetail>>();
const siteCache = new Map<string, PublicSite>();
const siteInflight = new Map<string, Promise<PublicSite>>();

function pageCacheKey(siteSlug: string, pageSlug: string) {
  return `${siteSlug}/${pageSlug}`;
}

/** @internal test helper */
export function resetPublicSiteCache() {
  pageCache.clear();
  pageInflight.clear();
  siteCache.clear();
  siteInflight.clear();
}

/** Drop cached public site/page payloads (e.g. after admin clears OpenAPI). */
export function invalidatePublicSite(siteSlug?: string) {
  if (!siteSlug) {
    resetPublicSiteCache();
    return;
  }
  siteCache.delete(siteSlug);
  siteInflight.delete(siteSlug);
  for (const key of [...pageCache.keys()]) {
    if (key === siteSlug || key.startsWith(`${siteSlug}/`)) {
      pageCache.delete(key);
      pageInflight.delete(key);
    }
  }
}

export const usePublicSite = () => {
  function getCachedPage(siteSlug: string, pageSlug: string): PublicSitePageDetail | undefined {
    return pageCache.get(pageCacheKey(siteSlug, pageSlug));
  }

  function getCachedSite(siteSlug: string): PublicSite | undefined {
    return siteCache.get(siteSlug);
  }

  async function fetchSite(slug: string): Promise<PublicSite> {
    const cached = siteCache.get(slug);
    if (cached) return cached;

    const inflight = siteInflight.get(slug);
    if (inflight) return inflight;

    const promise = $fetch<{ data: PublicSite }>(`/api/public/sites/${slug}`)
      .then((res) => {
        siteCache.set(slug, res.data);
        siteInflight.delete(slug);
        return res.data;
      })
      .catch((err) => {
        siteInflight.delete(slug);
        throw err;
      });

    siteInflight.set(slug, promise);
    return promise;
  }

  async function fetchPage(siteSlug: string, pageSlug: string): Promise<PublicSitePageDetail> {
    const key = pageCacheKey(siteSlug, pageSlug);
    const cached = pageCache.get(key);
    if (cached) return cached;

    const inflight = pageInflight.get(key);
    if (inflight) return inflight;

    const promise = $fetch<{ data: PublicSitePageDetail }>(
      `/api/public/sites/${siteSlug}/${pageSlug}`,
    )
      .then((res) => {
        pageCache.set(key, res.data);
        pageInflight.delete(key);
        return res.data;
      })
      .catch((err) => {
        pageInflight.delete(key);
        throw err;
      });

    pageInflight.set(key, promise);
    return promise;
  }

  function prefetchPage(siteSlug: string, pageSlug: string) {
    if (pageCache.has(pageCacheKey(siteSlug, pageSlug))) return;
    void fetchPage(siteSlug, pageSlug).catch(() => {});
  }

  function prefetchSite(siteSlug: string) {
    if (siteCache.has(siteSlug)) return;
    void fetchSite(siteSlug).catch(() => {});
  }

  return {
    fetchSite,
    fetchPage,
    getCachedPage,
    getCachedSite,
    prefetchPage,
    prefetchSite,
  };
};
