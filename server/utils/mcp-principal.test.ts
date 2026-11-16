import { describe, it, expect } from "vitest";
import {
  checkMcpToolAccess,
  mcpCanReadDraftAdrs,
  mcpPublishedOnly,
  principalFingerprint,
  type McpPrincipal,
} from "./mcp-principal";
import { scopeIncludesMcpRead } from "./mcp-oauth/tokens";
import type { AuthContext } from "./rbac";

const servicePrincipal: McpPrincipal = {
  kind: "service",
  principalId: "sp1",
  role: "mcp_service",
  permissions: ["apps:read", "docs:read", "mcp:access"],
};

function userPrincipal(overrides?: Partial<AuthContext>): McpPrincipal {
  return {
    kind: "user",
    userId: "user-123",
    clientId: "mcp_abc",
    scope: "mcp:read",
    auth: {
      user: { id: "user-123", email: "viewer@example.com" },
      isSuperAdmin: false,
      role: "viewer",
      permissions: ["apps:read", "docs:read"],
      matrix: {} as AuthContext["matrix"],
      ...overrides,
    },
  };
}

describe("principalFingerprint", () => {
  it("binds sessions to the user id, not the client", () => {
    expect(principalFingerprint(userPrincipal())).toBe("user:user-123");
    expect(principalFingerprint(servicePrincipal)).toBe("service:sp1");
  });
});

describe("mcpPublishedOnly / mcpCanReadDraftAdrs", () => {
  it("restricts service principals to published content without draft ADRs", () => {
    expect(mcpPublishedOnly(servicePrincipal)).toBe(true);
    expect(mcpCanReadDraftAdrs(servicePrincipal)).toBe(false);
  });

  it("lets users with adrs:read see draft ADRs, others only published", () => {
    expect(mcpPublishedOnly(userPrincipal())).toBe(false);
    expect(mcpCanReadDraftAdrs(userPrincipal())).toBe(false);
    expect(
      mcpCanReadDraftAdrs(userPrincipal({ permissions: ["docs:read", "adrs:read"] })),
    ).toBe(true);
  });
});

describe("checkMcpToolAccess", () => {
  it("grants tools the role is permitted for", () => {
    expect(checkMcpToolAccess(userPrincipal(), "list_docs", "docs:read")).toBeNull();
  });

  it("denies with an actionable error when the permission is missing", () => {
    const denied = checkMcpToolAccess(userPrincipal(), "list_owners", "owners:read");
    expect(denied).not.toBeNull();
    expect(denied?.isError).toBe(true);
    const body = JSON.parse(denied!.content[0]!.text);
    expect(body.missing_permission).toBe("owners:read");
    expect(body.your_role).toBe("viewer");
  });

  it("lets super admins through without a role", () => {
    const principal = userPrincipal({ isSuperAdmin: true, role: null, permissions: [] });
    expect(checkMcpToolAccess(principal, "list_owners", "owners:read")).toBeNull();
  });

  it("lets service principals use read tools but not admin ones", () => {
    expect(checkMcpToolAccess(servicePrincipal, "list_docs", "docs:read")).toBeNull();
    const denied = checkMcpToolAccess(servicePrincipal, "x", "adrs:read");
    expect(denied?.isError).toBe(true);
  });

  it("denies service tools when role permissions lack the key", () => {
    const limited: McpPrincipal = {
      kind: "service",
      principalId: "sp2",
      role: "auditor",
      permissions: ["adrs:read", "mcp:access"],
    };
    expect(checkMcpToolAccess(limited, "list_docs", "docs:read")?.isError).toBe(true);
    expect(checkMcpToolAccess(limited, "x", "adrs:read")).toBeNull();
  });
});

describe("scopeIncludesMcpRead", () => {
  it("accepts mcp:read scopes", () => {
    expect(scopeIncludesMcpRead("mcp:read")).toBe(true);
    expect(scopeIncludesMcpRead("mcp:read offline")).toBe(true);
    expect(scopeIncludesMcpRead("other")).toBe(false);
  });
});
