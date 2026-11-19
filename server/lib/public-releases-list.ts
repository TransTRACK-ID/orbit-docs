type ReleaseRow = {
  id: string;
  appId: string;
  appName: string;
  version: string | null;
  releaseDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  heroTitle: string | null;
  summary: string | null;
  categories: {
    added?: string[];
    fixed?: string[];
    changed?: string[];
    deprecated?: string[];
    security?: string[];
  } | null;
};

function categoryCount(categories: ReleaseRow["categories"]): number {
  if (!categories) return 0;
  return Object.values(categories).reduce((sum, items) => sum + (items?.length ?? 0), 0);
}

function hasVisibleBody(row: ReleaseRow): boolean {
  if (row.summary?.trim()) return true;
  return categoryCount(row.categories) > 0;
}

function releaseDedupeKey(row: ReleaseRow): string {
  const day = (row.releaseDate || row.createdAt || "").slice(0, 10);
  const version = (row.version || "").trim().toLowerCase();
  const title = (row.heroTitle || "").trim().toLowerCase();
  return [row.appId, day, version, title].join("|");
}

/**
 * Drop duplicate published releases that share the same app/day/version/title.
 * When two rows collide, keep the one with more content, then the newest update.
 */
export function dedupePublicReleases<T extends ReleaseRow>(rows: T[]): T[] {
  const kept = new Map<string, T>();

  for (const row of rows) {
    const key = releaseDedupeKey(row);
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, row);
      continue;
    }

    const existingScore = hasVisibleBody(existing) ? 2 : 0;
    const rowScore = hasVisibleBody(row) ? 2 : 0;
    if (rowScore > existingScore) {
      kept.set(key, row);
      continue;
    }
    if (rowScore < existingScore) continue;

    const existingUpdated = Date.parse(existing.updatedAt || existing.createdAt || "") || 0;
    const rowUpdated = Date.parse(row.updatedAt || row.createdAt || "") || 0;
    if (rowUpdated >= existingUpdated) {
      kept.set(key, row);
    }
  }

  return [...kept.values()];
}