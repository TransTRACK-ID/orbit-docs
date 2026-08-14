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

/** Internal wiki path — available for non-archived sites (includes drafts). */
export function buildDocSiteWikiPath(site: { slug: string; status: string }): string | null {
  if (site.status === "archived") return null;
  return `/wiki/${site.slug}`;
}

export function buildDocWikiPath(doc: DocPublicUrlInput): string | null {
  if (
    doc.siteId &&
    doc.siteSlug &&
    doc.siteStatus !== "archived" &&
    doc.status !== "archived" &&
    doc.slug
  ) {
    return `/wiki/${doc.siteSlug}/${doc.slug}`;
  }
  return null;
}

export function buildWikiUrls(path: string | null): PublicUrlResult {
  return buildPublicUrls(path);
}

export function buildDocWikiUrls(doc: DocPublicUrlInput): PublicUrlResult {
  return buildWikiUrls(buildDocWikiPath(doc));
}

export function buildDocSiteWikiUrls(site: { slug: string; status: string }): PublicUrlResult {
  return buildWikiUrls(buildDocSiteWikiPath(site));
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

/**
 * When MCP_API_KEY is set, authenticated MCP clients are internal agents.
 * Prefer internal wiki URLs over public /s/ and /p/ links for doc sites.
 */
export function isMcpInternalLinkMode(): boolean {
  return Boolean(process.env.MCP_API_KEY);
}

export function buildMcpShareLinks(
  publicLinks: PublicUrlResult,
  wikiLinks: PublicUrlResult,
): PublicUrlResult {
  if (isMcpInternalLinkMode() && wikiLinks.path) {
    return wikiLinks;
  }
  return publicLinks;
}

export interface McpDocLinkFields {
  publicPath: string | null;
  publicUrl: string | null;
  wikiPath: string | null;
  wikiUrl: string | null;
  sharePath: string | null;
  shareUrl: string | null;
}

export function buildMcpDocLinkFields(doc: DocPublicUrlInput): McpDocLinkFields {
  const publicLinks = buildDocPublicUrls(doc);
  const wikiLinks = buildDocWikiUrls(doc);
  const shareLinks = buildMcpShareLinks(publicLinks, wikiLinks);
  return {
    publicPath: publicLinks.path,
    publicUrl: publicLinks.url,
    wikiPath: wikiLinks.path,
    wikiUrl: wikiLinks.url,
    sharePath: shareLinks.path,
    shareUrl: shareLinks.url,
  };
}

export interface McpDocSiteLinkFields {
  publicPath: string | null;
  publicUrl: string | null;
  wikiPath: string | null;
  wikiUrl: string | null;
  sharePath: string | null;
  shareUrl: string | null;
}

export function buildMcpDocSiteLinkFields(site: DocSitePublicUrlInput): McpDocSiteLinkFields {
  const publicLinks = buildDocSitePublicUrls(site);
  const wikiLinks = buildDocSiteWikiUrls(site);
  const shareLinks = buildMcpShareLinks(publicLinks, wikiLinks);
  return {
    publicPath: publicLinks.path,
    publicUrl: publicLinks.url,
    wikiPath: wikiLinks.path,
    wikiUrl: wikiLinks.url,
    sharePath: shareLinks.path,
    shareUrl: shareLinks.url,
  };
}
