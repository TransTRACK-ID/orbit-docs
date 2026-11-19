import { headingSlug } from "~/composables/useMarkdown";

export type PublishedPageRef = { slug: string; title: string };

/**
 * Resolve a requested public page slug to a published page on the site.
 * Handles case differences and legacy markdown filenames (e.g. FOO_BAR.md).
 */
export function resolvePublishedPageSlug(
  requested: string,
  pages: PublishedPageRef[],
): PublishedPageRef | undefined {
  if (!requested || !pages.length) return undefined;

  const exact = pages.find((p) => p.slug === requested);
  if (exact) return exact;

  const lower = requested.toLowerCase();
  const caseInsensitive = pages.find((p) => p.slug.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;

  const withoutMd = requested.replace(/\.md$/i, "");
  if (withoutMd !== requested) {
    const mdStemMatch = pages.find((p) => p.slug.toLowerCase() === withoutMd.toLowerCase());
    if (mdStemMatch) return mdStemMatch;

    const fromStem = headingSlug(withoutMd.replace(/_/g, " "));
    const normalized = pages.find((p) => p.slug === fromStem);
    if (normalized) return normalized;

    if (/instalasi/i.test(withoutMd) && /transtrack/i.test(withoutMd)) {
      const mdmCloud = pages.find((p) => p.slug.includes("mdm-cloud"));
      if (mdmCloud) return mdmCloud;
    }
  }

  const decoded = decodeURIComponent(requested);
  if (decoded !== requested) {
    return resolvePublishedPageSlug(decoded, pages);
  }

  return undefined;
}

/** Rewrite relative `*.md` doc links to sibling page slugs when we can resolve them. */
export function rewritePublicSiteMarkdownLinks(
  md: string,
  pages: PublishedPageRef[],
): string {
  if (!md || !pages.length) return md;

  return md.replace(
    /\[([^\]]*)\]\(([^)\s#]+)(#[^)\s]*)?\)/g,
    (full, label: string, href: string, hash = "") => {
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return full;
      const pathPart = href.split("?")[0] || href;
      if (!/\.md$/i.test(pathPart) && !/[A-Z_]+\.md$/i.test(pathPart)) return full;

      const fileName = pathPart.replace(/^\.?\//, "");
      const resolved = resolvePublishedPageSlug(fileName, pages);
      if (!resolved) return full;

      const prefix = pathPart.startsWith("../")
        ? "../"
        : pathPart.startsWith("./")
          ? "./"
          : "";
      return `[${label}](${prefix}${resolved.slug}${hash || ""})`;
    },
  );
}