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
 * Infer app + version from common Notion release title formats:
 * - "RegisT Request Visits: v.78.1"
 * - "Bunkering Production: v.1.0"
 * - "🚢VESMON v2.4.0: Elevating Maritime Intelligence"
 * - "🚢 VESMON: Elevating Maritime Intelligence" (app only)
 */
export function inferFromTitle(title: string): InferredTitleMeta {
  const cleaned = stripLeadingDecorators(title);

  // "App Name: v.78.1" or "App Name: v1.0"
  const colonVersion = cleaned.match(/^(.+?):\s*v\.?(\d+(?:\.\d+)*)\s*$/i);
  if (colonVersion) {
    return { appName: colonVersion[1].trim(), version: colonVersion[2] };
  }

  // "VESMON v2.4.0: subtitle"
  const spaceVersion = cleaned.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+v(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/i);
  if (spaceVersion) {
    return { appName: spaceVersion[1], version: spaceVersion[2] };
  }

  // "VESMON: Elevating Maritime Intelligence" (no version in title)
  const colonOnly = cleaned.match(/^([^:]+):\s*.+$/);
  if (colonOnly) {
    const appName = colonOnly[1].trim();
    if (appName.length > 0) {
      return { appName, version: null };
    }
  }

  return { appName: null, version: null };
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
): string | null {
  const fromProperty = getPlainTextFromProperty(
    findPropertyByName(page.properties, versionPropertyName)
  ).trim();

  if (fromProperty) return fromProperty;

  const inferred = inferFromTitle(title);
  if (inferred.version) return inferred.version;

  return null;
}
