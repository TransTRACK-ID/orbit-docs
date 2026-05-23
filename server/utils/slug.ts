/**
 * Generate a URL-friendly slug from a string.
 * - Lowercases everything
 * - Removes non-alphanumeric characters (except spaces)
 * - Replaces spaces with hyphens
 * - Collapses multiple hyphens
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a random suffix for slug conflict resolution.
 * Uses lowercase alphanumeric characters.
 */
export function generateRandomSuffix(length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if a workspace slug already exists in the database.
 * Excludes a specific workspace ID when updating an existing record.
 */
export async function isSlugTaken(
  db: any,
  table: any,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const { eq, and, ne } = await import("drizzle-orm");

  const conditions = [eq(table.slug, slug)];
  if (excludeId) {
    conditions.push(ne(table.id, excludeId));
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  return rows.length > 0;
}

/**
 * Generate a unique slug from a name, checking the database for conflicts.
 * If the slug is taken, appends a random suffix until a unique one is found.
 */
export async function generateUniqueSlug(
  db: any,
  table: any,
  name: string,
  excludeId?: string
): Promise<string> {
  let baseSlug = slugify(name);

  if (!baseSlug) {
    baseSlug = "workspace";
  }

  if (!(await isSlugTaken(db, table, baseSlug, excludeId))) {
    return baseSlug;
  }

  // Try appending a random suffix
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const candidate = `${baseSlug}-${generateRandomSuffix(4)}`;
    if (!(await isSlugTaken(db, table, candidate, excludeId))) {
      return candidate;
    }
    attempts++;
  }

  // Fallback: use timestamp suffix
  return `${baseSlug}-${Date.now()}`;
}
