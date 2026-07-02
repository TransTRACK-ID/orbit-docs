import type { NotionClient, NotionPage } from "./client";
import {
  findPropertyByName,
  getPropertyText,
  getTitleFromPage,
  normalizeDisplayName,
} from "./client";

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

/** Subtitle after the first colon, e.g. "VESMON: Elevating Maritime Intelligence". */
export function extractTitleSubtitle(title: string): string | null {
  const cleaned = stripLeadingDecorators(title);
  const match = cleaned.match(/^[^:]+:\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

export async function resolveAppName(
  client: NotionClient,
  page: NotionPage,
  appPropertyName: string
): Promise<{ appName: string; source: "property" | "title" } | null> {
  const fromProperty = await getPropertyText(
    client,
    findPropertyByName(page.properties, appPropertyName)
  );

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

export async function resolveVersionLabel(
  client: NotionClient,
  page: NotionPage,
  versionPropertyName: string,
  title: string
): Promise<string> {
  const fromProperty = await getPropertyText(
    client,
    findPropertyByName(page.properties, versionPropertyName)
  );

  if (fromProperty) return fromProperty;

  const inferred = inferFromTitle(title);
  if (inferred.version) return inferred.version;

  const subtitle = extractTitleSubtitle(title);
  if (subtitle) return subtitle;

  return `notion-${page.id.replace(/-/g, "").slice(0, 8)}`;
}

export function normalizeAppMatchKey(name: string): string {
  return normalizeDisplayName(name).toLowerCase();
}

/** Extract alias from trailing parentheses, e.g. "Vessel Monitoring (VESMON)". */
export function extractParentheticalAlias(name: string): string | null {
  const match = name.match(/\(([^)]+)\)\s*$/);
  return match?.[1]?.trim() || null;
}
