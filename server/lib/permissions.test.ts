import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSION_MATRIX,
  mergeMatrixWithDefaults,
  listPermissionsForRole,
  roleHasPermission,
} from "./permissions";

describe("permissions", () => {
  it("gives viewer read-only access", () => {
    expect(roleHasPermission("viewer", "docs:read", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("viewer", "docs:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(false);
  });

  it("gives admin workspace management permissions", () => {
    expect(roleHasPermission("admin", "settings:write", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
    expect(roleHasPermission("admin", "team:manage", DEFAULT_ROLE_PERMISSION_MATRIX)).toBe(true);
  });

  it("merges stored overrides without dropping defaults", () => {
    const merged = mergeMatrixWithDefaults({
      viewer: { "docs:write": true },
    });

    expect(merged.viewer["docs:read"]).toBe(true);
    expect(merged.viewer["docs:write"]).toBe(true);
    expect(merged.admin["settings:write"]).toBe(true);
  });

  it("lists enabled permissions for a role", () => {
    const keys = listPermissionsForRole("tech_writer", DEFAULT_ROLE_PERMISSION_MATRIX);
    expect(keys).toContain("docs:write");
    expect(keys).not.toContain("team:manage");
  });
});
