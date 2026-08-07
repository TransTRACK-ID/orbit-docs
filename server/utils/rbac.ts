import { type H3Event, createError } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { users, rolePermissions } from "~/server/database/schema";
import type { PermissionKey, RolePermissionMatrix } from "~/types/permissions";
import type { TeamRole } from "~/types/settings";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSION_MATRIX,
  mergeMatrixWithDefaults,
  listPermissionsForRole,
  roleHasPermission,
} from "~/server/lib/permissions";
import { requireAuth, type SessionUser } from "./auth";
import { getCurrentMember, type TeamRole as ServerTeamRole } from "./team-access";

export interface AuthContext {
  user: SessionUser;
  isSuperAdmin: boolean;
  role: TeamRole | null;
  permissions: PermissionKey[];
  matrix: RolePermissionMatrix;
}

let cachedMatrix: RolePermissionMatrix | null = null;
let cacheLoadedAt = 0;
const MATRIX_CACHE_MS = 30_000;

export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0]);

  return Boolean(row?.isSuperAdmin);
}

export async function loadRolePermissionMatrix(force = false): Promise<RolePermissionMatrix> {
  const now = Date.now();
  if (!force && cachedMatrix && now - cacheLoadedAt < MATRIX_CACHE_MS) {
    return cachedMatrix;
  }

  const db = getDb();
  const rows = await db.select().from(rolePermissions);
  const stored: Partial<Record<TeamRole, Partial<Record<PermissionKey, boolean>>>> = {};

  for (const row of rows) {
    const role = row.role as TeamRole;
    const permission = row.permission as PermissionKey;
    if (!stored[role]) stored[role] = {};
    stored[role]![permission] = row.allowed;
  }

  cachedMatrix = mergeMatrixWithDefaults(stored);
  cacheLoadedAt = now;
  return cachedMatrix;
}

export function invalidatePermissionCache() {
  cachedMatrix = null;
  cacheLoadedAt = 0;
}

export async function seedDefaultRolePermissions() {
  const db = getDb();
  const existing = await db.select({ id: rolePermissions.id }).from(rolePermissions).limit(1);
  if (existing.length > 0) return;

  const values = Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX).flatMap(([role, permissions]) =>
    Object.entries(permissions).map(([permission, allowed]) => ({
      id: crypto.randomUUID(),
      role: role as TeamRole,
      permission,
      allowed,
    }))
  );

  if (values.length > 0) {
    await db.insert(rolePermissions).values(values);
  }

  invalidatePermissionCache();
}

export async function saveRolePermissionMatrix(matrix: RolePermissionMatrix) {
  const db = getDb();
  await db.delete(rolePermissions);

  const values = Object.entries(matrix).flatMap(([role, permissions]) =>
    Object.entries(permissions).map(([permission, allowed]) => ({
      id: crypto.randomUUID(),
      role: role as TeamRole,
      permission,
      allowed,
    }))
  );

  if (values.length > 0) {
    await db.insert(rolePermissions).values(values);
  }

  invalidatePermissionCache();
}

export async function getAuthContext(event: H3Event): Promise<AuthContext> {
  const user = await requireAuth(event);
  const matrix = await loadRolePermissionMatrix();

  if (user.id === "preview-user") {
    return {
      user,
      isSuperAdmin: true,
      role: "admin",
      permissions: ALL_PERMISSION_KEYS,
      matrix,
    };
  }

  const isSuperAdmin = user.id ? await isUserSuperAdmin(user.id) : false;
  const member = await getCurrentMember(event);
  const role = (member?.role as TeamRole | undefined) ?? null;

  if (isSuperAdmin) {
    return {
      user,
      isSuperAdmin: true,
      role,
      permissions: ALL_PERMISSION_KEYS,
      matrix,
    };
  }

  if (!member || !role) {
    return {
      user,
      isSuperAdmin: false,
      role: null,
      permissions: [],
      matrix,
    };
  }

  return {
    user,
    isSuperAdmin: false,
    role,
    permissions: listPermissionsForRole(role, matrix),
    matrix,
  };
}

export async function requirePermission(
  event: H3Event,
  permission: PermissionKey
): Promise<AuthContext> {
  const context = await getAuthContext(event);

  if (context.isSuperAdmin) {
    return context;
  }

  if (!context.role) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You are not a member of this workspace.",
    });
  }

  if (!roleHasPermission(context.role, permission, context.matrix)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: `Missing permission: ${permission}`,
    });
  }

  return context;
}

export async function requireSuperAdmin(event: H3Event): Promise<AuthContext> {
  const context = await getAuthContext(event);

  if (!context.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Super admin access is required.",
    });
  }

  return context;
}

export function mapTeamRoleToPermissions(
  role: ServerTeamRole,
  matrix: RolePermissionMatrix
): PermissionKey[] {
  return listPermissionsForRole(role as TeamRole, matrix);
}
