import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface WikiRepoInventory {
  totalFiles: number;
  paths: string[];
  truncated: boolean;
  moduleCount: number;
}

const MAX_PATHS = 2000;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  "vendor",
  "target",
  "__pycache__",
]);

export function wikiModuleKey(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 1) return ".";
  if (segments.length === 2) return segments[0];
  return `${segments[0]}/${segments[1]}`;
}

function countModules(paths: string[]): { moduleCount: number; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const key = wikiModuleKey(path);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let moduleCount = 0;
  for (const count of counts.values()) {
    if (count >= 3) moduleCount++;
  }
  return { moduleCount, counts };
}

export function summarizeWikiPaths(paths: string[]): WikiRepoInventory {
  const sorted = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const totalFiles = paths.length;
  const capped = sorted.slice(0, MAX_PATHS);
  const { moduleCount } = countModules(sorted);
  return {
    totalFiles,
    paths: capped,
    truncated: totalFiles > MAX_PATHS,
    moduleCount,
  };
}

export function computeWikiPageBudget(
  totalFiles: number,
  moduleCount: number,
): { min: number; max: number } {
  if (totalFiles < 200 && moduleCount < 10) return { min: 15, max: 25 };
  if (totalFiles < 1000 && moduleCount < 30) return { min: 25, max: 40 };
  return { min: 40, max: 60 };
}

export async function collectWikiRepoInventory(repoDir: string): Promise<WikiRepoInventory> {
  const paths: string[] = [];

  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(join(absDir, entry.name), rel);
      } else if (entry.isFile()) {
        paths.push(rel);
      }
    }
  }

  try {
    // Probe root readability distinctly: walk() swallowing root error already
    // yields empty paths, which summarize turns into the empty inventory.
    await walk(repoDir, "");
  } catch {
    return { totalFiles: 0, paths: [], truncated: false, moduleCount: 0 };
  }
  return summarizeWikiPaths(paths);
}

export async function readReadmeExcerpt(repoDir: string): Promise<string> {
  try {
    const content = await readFile(join(repoDir, "README.md"), "utf8");
    return content.slice(0, 4000);
  } catch {
    return "";
  }
}

export function formatWikiInventoryContext(
  repos: Array<{
    name: string;
    repoUrl: string;
    dir: string;
    inventory: WikiRepoInventory;
    readmeExcerpt: string;
  }>,
): { outlineContext: string; pageContext: string } {
  const outlineParts: string[] = [];
  const pageParts: string[] = [];

  for (const repo of repos) {
    const { inventory } = repo;
    const header =
      `### Repository: ${repo.name} (${repo.repoUrl})\n` +
      `Local path: ${repo.dir}\n` +
      `Files: ${inventory.totalFiles}${inventory.truncated ? " (listing truncated to first 2000 paths)" : ""}\n`;

    // Group capped paths by module key, preserving sorted order.
    const groups = new Map<string, string[]>();
    for (const path of inventory.paths) {
      const key = wikiModuleKey(path);
      const list = groups.get(key);
      if (list) list.push(path);
      else groups.set(key, [path]);
    }

    let outline = header;
    if (repo.readmeExcerpt) outline += `README excerpt:\n${repo.readmeExcerpt}\n`;
    outline += `File inventory:\n`;
    const blocks: string[] = [];
    for (const [key, list] of groups) {
      blocks.push(`${key}/ (${list.length} files)\n${list.map((p) => `  - ${p}`).join("\n")}`);
    }
    outline += blocks.join("\n");
    outlineParts.push(outline);

    // Module counts computed over the full (uncapped-count) grouping of capped
    // paths for display; counts mirror the inventory listing.
    const { counts } = countModules(inventory.paths);
    const modules = [...counts.entries()].map(([key, count]) => `${key} (${count})`).join(", ");
    pageParts.push(`${header}Modules: ${modules}`);
  }

  const intro = `This product is composed of ${repos.length} repositories. Analyze ALL of them.`;
  return {
    outlineContext: `${intro}\n\n${outlineParts.join("\n\n")}`,
    pageContext: `${intro}\n\n${pageParts.join("\n\n")}`,
  };
}
