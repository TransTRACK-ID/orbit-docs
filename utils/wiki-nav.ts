import type { NavConfig, NavGroup } from "~/server/database/schema";
import { slugify } from "~/utils/nav-client";

export interface WikiNavPage {
  slug: string;
  groupPath?: string[];
}

interface NavNode {
  label: string;
  id: string;
  pages: string[];
  children: Map<string, NavNode>;
}

/**
 * Build site nav from a wiki outline. Each page appears once: grouped pages
 * walk/create their groupPath chain (1–3 labels) and land in the leaf node;
 * ungrouped pages go in the top-level `pages` list. A node may hold both its
 * own `pages` and child `groups`.
 * Overview is not pinned into both a group and `pages`.
 */
export function buildNavConfigFromPlan(plan: { pages: WikiNavPage[] }): NavConfig {
  const roots = new Map<string, NavNode>();
  const ungrouped: string[] = [];
  const seen = new Set<string>();
  let groupCounter = 0;

  function createNode(labelPath: string[]): NavNode {
    groupCounter++;
    const joined = labelPath.map((segment) => slugify(segment)).join("-");
    const id = joined || `group-${groupCounter}`;
    return { label: labelPath[labelPath.length - 1], id, pages: [], children: new Map() };
  }

  for (const page of plan.pages) {
    const slug = page.slug?.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const labels = (page.groupPath ?? [])
      .map((label) => (typeof label === "string" ? label.trim() : ""))
      .filter((label) => label.length > 0);

    if (!labels.length) {
      ungrouped.push(slug);
      continue;
    }

    let level = roots;
    let node: NavNode | undefined;
    const pathSoFar: string[] = [];
    for (const label of labels) {
      pathSoFar.push(label);
      node = level.get(label);
      if (!node) {
        node = createNode([...pathSoFar]);
        level.set(label, node);
      }
      level = node.children;
    }
    node!.pages.push(slug);
  }

  function toNavGroup(node: NavNode): NavGroup {
    const group: NavGroup = { id: node.id, label: node.label };
    if (node.pages.length) group.pages = node.pages;
    if (node.children.size) group.groups = [...node.children.values()].map(toNavGroup);
    return group;
  }

  return {
    groups: [...roots.values()].map(toNavGroup),
    pages: ungrouped,
    external: [],
  };
}
