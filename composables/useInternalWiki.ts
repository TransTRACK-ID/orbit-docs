import type { NavConfig, NormalizedOpenApi } from "~/server/database/schema";

export interface WikiSitePage {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  updatedAt: string | null;
}

export interface WikiSite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  navConfig: NavConfig | null;
  openapiNormalized: NormalizedOpenApi | null;
  app: { id: string; name: string } | null;
  pages: WikiSitePage[];
}

export interface WikiSitePageDetail {
  id: string;
  title: string;
  content: string | null;
  slug: string;
  status: string;
  frontmatter: Record<string, unknown> | null;
  author: string | null;
  updatedAt: string | null;
  site: {
    id: string;
    name: string;
    slug: string;
    status: string;
    navConfig: NavConfig | null;
    openapiNormalized?: NormalizedOpenApi | null;
    app: { id: string; name: string } | null;
    pages: Array<{ id: string; title: string; slug: string | null; status: string }>;
  };
}

const pageCache = new Map<string, WikiSitePageDetail>();
const pageInflight = new Map<string, Promise<WikiSitePageDetail>>();
const siteCache = new Map<string, WikiSite>();
const siteInflight = new Map<string, Promise<WikiSite>>();

function pageCacheKey(siteSlug: string, pageSlug: string) {
  return `${siteSlug}/${pageSlug}`;
}

/** @internal test helper */
export function resetInternalWikiCache() {
  pageCache.clear();
  pageInflight.clear();
  siteCache.clear();
  siteInflight.clear();
}

export function invalidateInternalWiki(siteSlug?: string) {
  if (!siteSlug) {
    resetInternalWikiCache();
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

export const useInternalWiki = () => {
  function getCachedPage(siteSlug: string, pageSlug: string): WikiSitePageDetail | undefined {
    return pageCache.get(pageCacheKey(siteSlug, pageSlug));
  }

  function getCachedSite(siteSlug: string): WikiSite | undefined {
    return siteCache.get(siteSlug);
  }

  async function fetchSite(slug: string): Promise<WikiSite> {
    const cached = siteCache.get(slug);
    if (cached) return cached;

    const inflight = siteInflight.get(slug);
    if (inflight) return inflight;

    const promise = $fetch<{ data: WikiSite }>(`/api/wiki/sites/${slug}`)
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

  async function fetchPage(siteSlug: string, pageSlug: string): Promise<WikiSitePageDetail> {
    const key = pageCacheKey(siteSlug, pageSlug);
    const cached = pageCache.get(key);
    if (cached) return cached;

    const inflight = pageInflight.get(key);
    if (inflight) return inflight;

    const promise = $fetch<{ data: WikiSitePageDetail }>(
      `/api/wiki/sites/${siteSlug}/${pageSlug}`,
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
