import { asc } from "drizzle-orm";
import { getDb } from "~/server/database";
import { roles } from "~/server/database/schema";
import type { RoleDefinition } from "~/types/permissions";
import { SYSTEM_ROLES } from "~/server/lib/permissions";

let cachedRoles: RoleDefinition[] | null = null;
let cacheLoadedAt = 0;
const ROLES_CACHE_MS = 30_000;

export async function loadRoles(force = false): Promise<RoleDefinition[]> {
  const now = Date.now();
  if (!force && cachedRoles && now - cacheLoadedAt < ROLES_CACHE_MS) {
    return cachedRoles;
  }

  const db = getDb();
  const rows = await db.select().from(roles).orderBy(asc(roles.level), asc(roles.slug));

  cachedRoles = rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    kind: row.kind === "service" ? "service" : "member",
    isSystem: Boolean(row.isSystem),
    level: row.level ?? 0,
  }));
  cacheLoadedAt = now;
  return cachedRoles;
}

export function invalidateRolesCache() {
  cachedRoles = null;
  cacheLoadedAt = 0;
}

export async function seedDefaultRoles() {
  const db = getDb();
  for (const role of SYSTEM_ROLES) {
    await db
      .insert(roles)
      .values({
        id: crypto.randomUUID(),
        slug: role.slug,
        name: role.name,
        description: role.description,
        kind: role.kind,
        isSystem: role.isSystem,
        level: role.level,
      })
      .onConflictDoNothing({ target: roles.slug });
  }
  invalidateRolesCache();
}
