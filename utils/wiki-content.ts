export const WIKI_DOC_TYPE = "wiki";

export type WikiDocRef = { docType?: string | null };

/** Generated wiki pages are internal-only (`docType: wiki`). */
export function isWikiDoc(doc: WikiDocRef | null | undefined): boolean {
  return doc?.docType === WIKI_DOC_TYPE;
}

/**
 * Doc site whose pages are exclusively wiki docs (generated wiki sites).
 * Empty sites are not treated as wiki sites.
 */
export function isWikiOnlySiteFromPages(
  pages: Array<WikiDocRef>,
): boolean {
  if (pages.length === 0) return false;
  return pages.every((p) => isWikiDoc(p));
}

export function deriveWikiOnlySiteIds(
  rows: Array<{ siteId: string | null; docType: string | null }>,
): Set<string> {
  const bySite = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.siteId) continue;
    if (!bySite.has(row.siteId)) bySite.set(row.siteId, new Set());
    bySite.get(row.siteId)!.add(row.docType || "");
  }
  const wikiSites = new Set<string>();
  for (const [siteId, types] of bySite) {
    if (types.size === 1 && types.has(WIKI_DOC_TYPE)) wikiSites.add(siteId);
  }
  return wikiSites;
}

export const WIKI_FORBIDDEN_DOC_STATUSES = ["published", "archived"] as const;
export const WIKI_FORBIDDEN_SITE_STATUSES = ["published", "archived"] as const;

export function isForbiddenWikiDocStatus(status: string): boolean {
  return (WIKI_FORBIDDEN_DOC_STATUSES as readonly string[]).includes(status);
}

export function isForbiddenWikiSiteStatus(status: string): boolean {
  return (WIKI_FORBIDDEN_SITE_STATUSES as readonly string[]).includes(status);
}

export const WIKI_PUBLISH_BLOCKED_MESSAGE =
  "Wiki pages are internal-only and cannot be published to the public site.";

export const WIKI_SITE_PUBLISH_BLOCKED_MESSAGE =
  "Wiki doc sites are internal-only. Browse them at /wiki/{slug} — they cannot be published to /s/.";
