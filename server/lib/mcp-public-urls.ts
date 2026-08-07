export interface DocPublicUrlInput {
  id: string;
  status: string;
  slug?: string | null;
  siteId?: string | null;
  siteSlug?: string | null;
  siteStatus?: string | null;
}

export interface DocSitePublicUrlInput {
  slug: string;
  status: string;
}

export interface ReleasePublicUrlInput {
  id: string;
  published: boolean;
}

export interface PublicUrlResult {
  path: string | null;
  url: string | null;
}

export function getPublicAppBaseUrl(): string {
  return (
    process.env.NUXT_PUBLIC_APP_URL ||
    process.env.NUXT_APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
}

export function toAbsolutePublicUrl(path: string): string {
  const base = getPublicAppBaseUrl();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildDocPublicPath(doc: DocPublicUrlInput): string | null {
  if (
    doc.siteId &&
    doc.siteSlug &&
    doc.siteStatus === "published" &&
    doc.status === "published" &&
    doc.slug
  ) {
    return `/s/${doc.siteSlug}/${doc.slug}`;
  }

  if (doc.status === "published") {
    return `/p/${doc.id}`;
  }

  return null;
}

export function buildDocSitePublicPath(site: DocSitePublicUrlInput): string | null {
  if (site.status !== "published") return null;
  return `/s/${site.slug}`;
}

export function buildReleasePublicPath(release: ReleasePublicUrlInput): string | null {
  if (!release.published) return null;
  return `/p/releases/${release.id}`;
}

export function buildPublicUrls(path: string | null): PublicUrlResult {
  return {
    path,
    url: path ? toAbsolutePublicUrl(path) : null,
  };
}

export function buildDocPublicUrls(doc: DocPublicUrlInput): PublicUrlResult {
  return buildPublicUrls(buildDocPublicPath(doc));
}

export function buildDocSitePublicUrls(site: DocSitePublicUrlInput): PublicUrlResult {
  return buildPublicUrls(buildDocSitePublicPath(site));
}

export function buildReleasePublicUrls(release: ReleasePublicUrlInput): PublicUrlResult {
  return buildPublicUrls(buildReleasePublicPath(release));
}
