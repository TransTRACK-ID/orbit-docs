import type { NotionPage } from "./client";
import { findPropertyByName, getPlainTextFromProperty, getTitleFromPage } from "./client";

export interface InferredTitleMeta {
  appName: string | null;
  version: string | null;
}

/** Strip leading emoji / symbols so "🚢VESMON v2.4.0" parses reliably. */
function stripLeadingDecorators(text: string): string {
  return text.replace(/^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]+/u, "").trim();
}

/**
 * Infer app + version from release-style titles, e.g.
 * "🚢VESMON v2.4.0: Elevating Maritime Intelligence" → VESMON, 2.4.0
 */
export function inferFromTitle(title: string): InferredTitleMeta {
  const cleaned = stripLeadingDecorators(title);
  const match = cleaned.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+v(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/i);
  if (!match) {
    return { appName: null, version: null };
  }
  return {
    appName: match[1],
    version: match[2],
  };
}

export function resolveAppName(
  page: NotionPage,
  appPropertyName: string
): { appName: string; source: "property" | "title" } | null {
  const fromProperty = getPlainTextFromProperty(
    findPropertyByName(page.properties, appPropertyName)
  ).trim();

  if (fromProperty) {
    return { appName: fromProperty, source: "property" };
  }

  const title = getTitleFromPage(page);
  const inferred = inferFromTitle(title);
  if (inferred.appName) {
    return { appName: inferred.appName, source: "title" };
  }

  return null;
}

export function resolveVersionLabel(
  page: NotionPage,
  versionPropertyName: string,
  title: string
): string {
  const fromProperty = getPlainTextFromProperty(
    findPropertyByName(page.properties, versionPropertyName)
  ).trim();

  if (fromProperty) return fromProperty;

  const inferred = inferFromTitle(title);
  if (inferred.version) return inferred.version;

  return title;
}
