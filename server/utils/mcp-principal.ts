import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import type { SessionUser } from "./auth";
import { getAuthContextForUser, type AuthContext } from "./rbac";
import { getMemberForUser } from "./team-access";
import { verifyMcpAccessToken } from "./mcp-oauth/tokens";
import { isMcpOAuthEnabled } from "./mcp-oauth/config";
import type { PermissionKey } from "~/types/permissions";

/**
 * Who is behind an MCP connection.
 *
 * - `user`: an OAuth access token bound to a workspace user. The auth context
 *   is rebuilt from the database on every connection so role changes,
 *   deactivation, and removals take effect immediately.
 * - `service`: the static `MCP_API_KEY` (or an unconfigured server). A named
 *   automation identity restricted to published, read-only content.
 */
export type McpPrincipal =
  | {
      kind: "user";
      userId: string;
      clientId: string;
      scope: string;
      auth: AuthContext;
    }
  | { kind: "service" };

export const MCP_API_KEY = process.env.MCP_API_KEY;

/** Read-only permissions the service principal may exercise. */
const SERVICE_TOOL_PERMISSIONS: ReadonlySet<PermissionKey> = new Set([
  "apps:read",
  "owners:read",
  "versions:read",
  "releases:read",
  "changelogs:read",
  "docs:read",
  "doc_sites:read",
  "api_docs:read",
]);

function extractProvidedKey(
  authHeader: string | undefined,
  apiKeyHeader: string | undefined,
): string {
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return apiKeyHeader || "";
}

export async function resolveMcpPrincipal(
  authHeader: string | undefined,
  apiKeyHeader: string | undefined,
): Promise<McpPrincipal | null> {
  const providedKey = extractProvidedKey(authHeader, apiKeyHeader);

  if (MCP_API_KEY && providedKey === MCP_API_KEY) {
    return { kind: "service" };
  }

  if (isMcpOAuthEnabled() && authHeader?.startsWith("Bearer ")) {
    const payload = verifyMcpAccessToken(authHeader.slice(7));
    if (!payload) return null;
    return resolveUserPrincipal(payload.sub, payload.client_id, payload.scope);
  }

  // No static key and OAuth disabled: legacy open mode. Kept for local
  // development, restricted to published content like the service principal.
  if (!MCP_API_KEY && !isMcpOAuthEnabled()) {
    return { kind: "service" };
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

  return { kind: "user", userId, clientId, scope, auth };
}

/** Stable identity tag used to bind an MCP session to its principal. */
export function principalFingerprint(principal: McpPrincipal): string {
  return principal.kind === "service" ? "service" : `user:${principal.userId}`;
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
    if (SERVICE_TOOL_PERMISSIONS.has(permission)) return null;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "forbidden",
              tool: toolName,
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
