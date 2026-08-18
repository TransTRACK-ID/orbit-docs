import type { NavConfig, NavGroup } from "~/server/database/schema";
import { slugify } from "~/utils/nav-client";

export interface WikiNavPage {
  slug: string;
  group?: string;
}

/**
 * Build site nav from a wiki outline. Each page appears once: grouped pages
 * stay in their group; ungrouped pages go in the top-level `pages` list.
 * Overview is not pinned into both a group and `pages`.
 */
export function buildNavConfigFromPlan(plan: { pages: WikiNavPage[] }): NavConfig {
  const groupMap = new Map<string, string[]>();
  const ungrouped: string[] = [];
  const seen = new Set<string>();

  for (const page of plan.pages) {
    const slug = page.slug?.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const groupLabel = page.group?.trim();
    if (!groupLabel) {
      ungrouped.push(slug);
      continue;
    }
    if (!groupMap.has(groupLabel)) groupMap.set(groupLabel, []);
    groupMap.get(groupLabel)!.push(slug);
  }

  const groups: NavGroup[] = [...groupMap.entries()].map(([label, pages], index) => ({
    id: slugify(label) || `group-${index + 1}`,
    label,
    pages,
  }));

  return {
    groups,
    pages: ungrouped,
    external: [],
  };
}
