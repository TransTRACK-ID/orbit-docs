import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "~/server/database";
import { mcpServicePrincipals, users } from "~/server/database/schema";
import type { SessionUser } from "./auth";
import { getAuthContextForUser, loadRolePermissionMatrix, type AuthContext } from "./rbac";
import { getMemberForUser } from "./team-access";
import { scopeIncludesMcpRead, verifyMcpAccessToken } from "./mcp-oauth/tokens";
import { isMcpOAuthEnabled } from "./mcp-oauth/config";
import { MCP_SERVICE_ROLE_SLUG, listPermissionsForRole } from "~/server/lib/permissions";
import type { PermissionKey } from "~/types/permissions";

/**
 * Who is behind an MCP connection.
 *
 * - `user`: an OAuth access token bound to a workspace user. The auth context
 *   is rebuilt from the database on every connection so role changes,
 *   deactivation, and removals take effect immediately.
 * - `service`: an API key (env `MCP_API_KEY` or a named key) acting with its
 *   assigned role's permissions, restricted to published content.
 */
export type McpPrincipal =
  | {
      kind: "user";
      userId: string;
      clientId: string;
      scope: string;
      auth: AuthContext;
    }
  | {
      kind: "service";
      principalId: string | null;
      role: string;
      permissions: PermissionKey[];
    };

export const MCP_API_KEY = process.env.MCP_API_KEY;

function extractProvidedKey(
  authHeader: string | undefined,
  apiKeyHeader: string | undefined,
): string {
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return apiKeyHeader || "";
}

function timingSafeKeyEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type ServicePrincipalRow = typeof mcpServicePrincipals.$inferSelect;

async function touchLastUsed(row: ServicePrincipalRow): Promise<void> {
  const now = new Date();
  const last = row.lastUsedAt ? new Date(row.lastUsedAt) : null;
  if (last && now.getTime() - last.getTime() <= 5 * 60 * 1000) return;
  try {
    const db = getDb();
    await db
      .update(mcpServicePrincipals)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(mcpServicePrincipals.id, row.id));
  } catch {
    // Non-critical: don't fail the connection if activity tracking fails
  }
}

async function buildServicePrincipal(
  principalId: string | null,
  role: string,
  row?: ServicePrincipalRow | null,
): Promise<McpPrincipal | null> {
  const matrix = await loadRolePermissionMatrix();
  const permissions = listPermissionsForRole(role, matrix);
  if (!permissions.includes("mcp:access")) return null;
  if (row) await touchLastUsed(row);
  return { kind: "service", principalId, role, permissions };
}

export async function resolveMcpPrincipal(
  authHeader: string | undefined,
  apiKeyHeader: string | undefined,
): Promise<McpPrincipal | null> {
  const providedKey = extractProvidedKey(authHeader, apiKeyHeader);

  // 1. OAuth JWT. A Bearer token that verifies as an MCP JWT is
  // authoritative — never fall through to key checks.
  if (isMcpOAuthEnabled() && authHeader?.startsWith("Bearer ")) {
    const payload = verifyMcpAccessToken(authHeader.slice(7));
    if (payload) {
      if (!scopeIncludesMcpRead(payload.scope)) return null;
      return resolveUserPrincipal(payload.sub, payload.client_id, payload.scope);
    }
  }

  const db = getDb();

  // 2. Environment MCP_API_KEY, mapped to its (nullable-hash) DB row.
  if (MCP_API_KEY && providedKey && timingSafeKeyEqual(providedKey, MCP_API_KEY)) {
    let envRow: ServicePrincipalRow | null = null;
    try {
      envRow =
        (await db
          .select()
          .from(mcpServicePrincipals)
          .where(isNull(mcpServicePrincipals.keyHash))
          .limit(1)
          .then((rows) => rows[0])) ?? null;
    } catch {
      envRow = null;
    }
    if (envRow) {
      if (!envRow.isActive) return null;
      return buildServicePrincipal(envRow.id, envRow.role, envRow);
    }
    return buildServicePrincipal(null, MCP_SERVICE_ROLE_SLUG);
  }

  // 3. Named API key (SHA-256 lookup).
  if (providedKey) {
    const keyHash = createHash("sha256").update(providedKey).digest("hex");
    let namedRow: ServicePrincipalRow | null = null;
    try {
      namedRow =
        (await db
          .select()
          .from(mcpServicePrincipals)
          .where(
            and(eq(mcpServicePrincipals.keyHash, keyHash), eq(mcpServicePrincipals.isActive, true)),
          )
          .limit(1)
          .then((rows) => rows[0])) ?? null;
    } catch {
      namedRow = null;
    }
    if (namedRow) {
      return buildServicePrincipal(namedRow.id, namedRow.role, namedRow);
    }
  }

  // 4. No static key and OAuth disabled: legacy open mode. Kept for local
  // development, restricted to published content like the service principal.
  if (!MCP_API_KEY && !isMcpOAuthEnabled()) {
    return buildServicePrincipal(null, MCP_SERVICE_ROLE_SLUG);
  }

  return null;
}

async function resolveUserPrincipal(
  userId: string,
  clientId: string,
  scope: string,
): Promise<McpPrincipal | null> {
  const db = getDb();
  // The users row is optional: local/SSO bootstrap accounts may only have a
  // team membership row. Membership is the source of truth, like getAuthUser.
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const userRow = userRows[0];
  const member = await getMemberForUser({
    id: userId,
    email: userRow?.email,
  }).catch(() => null);
  if (!userRow && !member) return null;

  const sessionUser: SessionUser = {
    id: userId,
    email: userRow?.email ?? member?.email ?? userId,
    name: userRow?.name ?? member?.name ?? undefined,
  };
  const auth = await getAuthContextForUser(sessionUser);

  // Membership (or super-admin) is required for MCP access. Login and SSO
  // auto-provision membership, so a missing row means a removed user.
  if (!auth.isSuperAdmin && !auth.role) return null;
  if (!auth.isSuperAdmin && !auth.permissions.includes("mcp:access")) return null;

  return { kind: "user", userId, clientId, scope, auth };
}

/**
 * Re-resolve a principal from the database so role/permission changes,
 * membership removal, key deactivation, and `mcp:access` revocation take
 * effect on the next tool call without reconnecting.
 */
export async function refreshMcpPrincipal(
  principal: McpPrincipal,
): Promise<McpPrincipal | null> {
  if (principal.kind === "user") {
    if (!scopeIncludesMcpRead(principal.scope)) return null;
    return resolveUserPrincipal(principal.userId, principal.clientId, principal.scope);
  }

  if (principal.principalId) {
    const db = getDb();
    const row = await db
      .select()
      .from(mcpServicePrincipals)
      .where(eq(mcpServicePrincipals.id, principal.principalId))
      .limit(1)
      .then((rows) => rows[0])
      .catch(() => null);
    if (!row || !row.isActive) return null;
    return buildServicePrincipal(row.id, row.role, row);
  }

  return buildServicePrincipal(null, principal.role);
}

/** Stable identity tag used to bind an MCP session to its principal. */
export function principalFingerprint(principal: McpPrincipal): string {
  return principal.kind === "service"
    ? `service:${principal.principalId ?? "env"}`
    : `user:${principal.userId}`;
}

export function mcpPublishedOnly(principal: McpPrincipal): boolean {
  return principal.kind === "service";
}

export function mcpCanReadDraftAdrs(principal: McpPrincipal): boolean {
  if (principal.kind === "service") return false;
  return principal.auth.isSuperAdmin || principal.auth.permissions.includes("adrs:read");
}

/**
 * Returns an MCP tool error result when the principal may not call a tool
 * requiring `permission`, or null when access is granted.
 */
export function checkMcpToolAccess(
  principal: McpPrincipal,
  toolName: string,
  permission: PermissionKey | null,
): { content: { type: "text"; text: string }[]; isError: true } | null {
  if (!permission) return null;

  if (principal.kind === "service") {
    if (principal.permissions.includes(permission)) return null;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "forbidden",
              tool: toolName,
              missing_permission: permission,
              hint: "This tool needs a signed-in user with " +
                `'${permission}'. Connect with OAuth instead of the shared API key.`,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  if (principal.auth.isSuperAdmin || principal.auth.permissions.includes(permission)) {
    return null;
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: "forbidden",
            tool: toolName,
            missing_permission: permission,
            your_role: principal.auth.role,
            hint: "Ask a workspace admin for the required permission.",
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}
