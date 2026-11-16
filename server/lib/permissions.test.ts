import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSION_MATRIX,
  SYSTEM_ROLES,
  isValidRoleSlug,
  mergeMatrixWithDefaults,
  listPermissionsForRole,
  roleHasPermission,
} from "./permissions";

describe("permissions", () => {
  it("gives viewer read-only access", () => {
    expect(roleHasPermission("viewer", "docs:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("viewer", "docs:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(false);
  });

  it("gives admin ADR management permissions", () => {
    expect(roleHasPermission("admin", "adrs:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("admin", "adrs:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("admin", "adrs:publish", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
  });

  it("does not give product_manager ADR permissions by default", () => {
    expect(roleHasPermission("product_manager", "adrs:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      false
    );
    expect(roleHasPermission("product_manager", "adrs:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      false
    );
  });

  it("lets every role view owners but only PM and admin manage them by default", () => {
    expect(roleHasPermission("viewer", "owners:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("tech_writer", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      false
    );
    expect(roleHasPermission("product_manager", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      true
    );
    expect(roleHasPermission("admin", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
  });

  it("lets every role view owners but only PM and admin manage them by default", () => {
    expect(roleHasPermission("viewer", "owners:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("tech_writer", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      false
    );
    expect(roleHasPermission("product_manager", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(
      true
    );
    expect(roleHasPermission("admin", "owners:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
  });

  it("merges stored overrides without dropping defaults", () => {
    const merged = mergeMatrixWithDefaults(
      {
        viewer: { "docs:write": true },
      },
      ["viewer", "admin"]
    );

    expect(merged.viewer["docs:read"]).toBe(true);
    expect(merged.viewer["docs:write"]).toBe(true);
    expect(merged.admin["settings:write"]).toBe(true);
  });

  it("lists enabled permissions for a role", () => {
    const keys = listPermissionsForRole("tech_writer", DEFAULT_ROLE_PERMISSION_MATRIX);
    expect(keys).toContain("docs:write");
    expect(keys).not.toContain("team:manage");
  });

  it("merges custom slug to all-false then applies stored overrides", () => {
    const merged = mergeMatrixWithDefaults({ auditor: { "docs:read": true } }, ["auditor"]);
    expect(merged.auditor["docs:read"]).toBe(true);
    expect(merged.auditor["docs:write"]).toBe(false);
    expect(merged.auditor["mcp:access"]).toBe(false);
  });

  it("returns [] for unknown role in listPermissionsForRole", () => {
    expect(listPermissionsForRole("nonexistent", DEFAULT_ROLE_PERMISSION_MATRIX)).toEqual([]);
  });

  it("gives every builtin default mcp:access", () => {
    for (const slug of ["viewer", "tech_writer", "product_manager", "admin", "mcp_service"]) {
      expect(DEFAULT_ROLE_PERMISSION_MATRIX[slug]["mcp:access"]).toBe(true);
    }
  });

  it("mcp_service defaults equal 8 read keys + mcp:access, excluding adrs:read", () => {
    const keys = listPermissionsForRole("mcp_service", DEFAULT_ROLE_PERMISSION_MATRIX);
    expect(keys.sort()).toEqual(
      [
        "api_docs:read",
        "apps:read",
        "changelogs:read",
        "doc_sites:read",
        "docs:read",
        "mcp:access",
        "owners:read",
        "releases:read",
        "versions:read",
      ].sort()
    );
    expect(keys).not.toContain("adrs:read");
  });

  it("validates role slugs", () => {
    expect(isValidRoleSlug("auditor_2")).toBe(true);
    expect(isValidRoleSlug("Admin")).toBe(false);
    expect(isValidRoleSlug("1abc")).toBe(false);
    expect(isValidRoleSlug("a")).toBe(false);
    expect(isValidRoleSlug("a-b")).toBe(false);
    expect(isValidRoleSlug("a".repeat(41))).toBe(false);
  });

  it("defines system roles", () => {
    expect(SYSTEM_ROLES.map((r) => r.slug)).toContain("mcp_service");
  });
});
