import type { NavConfig, NavGroup } from "~/server/database/schema";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Collect every page slug referenced anywhere in a nav config (recursive). */
export function collectReferencedSlugs(cfg: NavConfig): string[] {
  const slugs = new Set<string>();
  const visitGroup = (g: NavGroup) => {
    if (g.pages) g.pages.forEach((p) => slugs.add(p));
    if (g.groups) g.groups.forEach(visitGroup);
  };
  if (cfg.pages) cfg.pages.forEach((p) => slugs.add(p));
  if (cfg.groups) cfg.groups.forEach(visitGroup);
  return [...slugs];
}

export function publishedPageSlugs(
  pages: Array<{ slug: string | null }>,
): string[] {
  return pages.map((p) => p.slug).filter((s): s is string => !!s);
}

/**
 * When nav config has no page slugs that match published pages, list all published pages.
 */
export function resolveFallbackPageSlugs(
  navConfig: NavConfig | null,
  pages: Array<{ slug: string | null }>,
): string[] {
  const published = publishedPageSlugs(pages);
  if (!published.length) return [];

  const publishedSet = new Set(published);
  const referenced = collectReferencedSlugs(navConfig || {});
  const hasResolvableNavPages = referenced.some((s) => publishedSet.has(s));

  if (!referenced.length || !hasResolvableNavPages) return published;
  return [];
}

/** Published pages not referenced anywhere in nav config. */
export function unlistedPublishedSlugs(
  navConfig: NavConfig | null,
  pages: Array<{ slug: string | null }>,
): string[] {
  const published = publishedPageSlugs(pages);
  if (!published.length) return [];

  const refSet = new Set(collectReferencedSlugs(navConfig || {}));
  return published.filter((s) => !refSet.has(s));
}
