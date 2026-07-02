export type GeneratedDocTabKey = string;

export interface GeneratedDocLinkSource {
  key: GeneratedDocTabKey;
  filenames: string[];
}

export interface GeneratedDocRepoLink {
  id: string;
  repoName: string;
}

function normalizeHrefPath(href: string): string {
  const path = href.split("#")[0].split("?")[0].trim();
  return path.replace(/^\.\//, "").replace(/^\//, "").toLowerCase();
}

function registerAliases(map: Map<string, GeneratedDocTabKey>, tabKey: GeneratedDocTabKey, filenames: string[]) {
  for (const name of filenames) {
    const lower = name.toLowerCase();
    map.set(lower, tabKey);
    map.set(`docs/${lower}`, tabKey);
  }
}

export function buildGeneratedDocLinkMap(sources: GeneratedDocLinkSource[]): Map<string, GeneratedDocTabKey> {
  const map = new Map<string, GeneratedDocTabKey>();
  for (const source of sources) {
    registerAliases(map, source.key, source.filenames);
  }
  return map;
}

export function buildGeneratedDocLinkSources(options: {
  availableTabs: GeneratedDocTabKey[];
  repos?: GeneratedDocRepoLink[];
}): GeneratedDocLinkSource[] {
  const available = new Set(options.availableTabs);
  const sources: GeneratedDocLinkSource[] = [];

  if (available.has("srs")) {
    sources.push({ key: "srs", filenames: ["SRS.md", "srs.md"] });
  }
  if (available.has("fsd")) {
    sources.push({ key: "fsd", filenames: ["FSD.md", "fsd.md"] });
  }
  if (available.has("git_snapshot")) {
    sources.push({
      key: "git_snapshot",
      filenames: ["GIT-SNAPSHOT.md", "git-snapshot.md", "git_snapshot.md"],
    });
  }
  if (available.has("sdd")) {
    sources.push({ key: "sdd", filenames: ["SDD.md", "sdd.md", "SDD-INDEX.md", "sdd-index.md"] });
  }

  const repoTabs = (options.repos || []).filter((repo) => available.has(`sdd:${repo.id}`));
  for (const repo of repoTabs) {
    const tabKey = `sdd:${repo.id}`;
    const filenames = [`SDD-${repo.repoName}.md`];
    if (repoTabs.length === 1) {
      filenames.push("SDD-Backend.md", "SDD-Frontend.md", "SDD-Mobile.md");
    }
    sources.push({ key: tabKey, filenames });
  }

  return sources;
}

export function resolveGeneratedDocTab(
  href: string,
  linkMap: Map<string, GeneratedDocTabKey>
): GeneratedDocTabKey | null {
  if (!href || /^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
    return null;
  }

  const normalized = normalizeHrefPath(href);
  if (!normalized) return null;

  const basename = normalized.split("/").pop() || normalized;

  const direct =
    linkMap.get(normalized) ||
    linkMap.get(basename) ||
    linkMap.get(`docs/${basename}`);
  if (direct) return direct;

  for (const [alias, tabKey] of linkMap.entries()) {
    if (normalized.endsWith(`/${alias}`)) return tabKey;
  }

  if (basename.startsWith("sdd-") && basename.endsWith(".md")) {
    const suffix = basename.slice(4, -3);
    for (const [alias, tabKey] of linkMap.entries()) {
      const aliasBase = alias.split("/").pop() || alias;
      if (!aliasBase.startsWith("sdd-") || !aliasBase.endsWith(".md")) continue;
      const aliasSuffix = aliasBase.slice(4, -3);
      if (aliasSuffix === suffix) return tabKey;
    }
  }

  return null;
}
