import type { TeamRole } from "./settings";

export type PermissionKey =
  | "apps:read"
  | "apps:write"
  | "apps:delete"
  | "versions:read"
  | "versions:write"
  | "versions:publish"
  | "releases:read"
  | "releases:write"
  | "releases:publish"
  | "changelogs:read"
  | "changelogs:write"
  | "docs:read"
  | "docs:write"
  | "docs:publish"
  | "doc_sites:read"
  | "doc_sites:write"
  | "api_docs:read"
  | "api_docs:write"
  | "feedback:read"
  | "feedback:manage"
  | "internal_feedback:read"
  | "internal_feedback:manage"
  | "settings:read"
  | "settings:write"
  | "team:read"
  | "team:invite"
  | "team:manage"
  | "integrations:read"
  | "integrations:write"
  | "api_keys:read"
  | "api_keys:write"
  | "doc_generation:read"
  | "doc_generation:run";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionDefinition[];
}

export type RolePermissionMatrix = Record<TeamRole, Record<PermissionKey, boolean>>;

export interface AccessSettingsResponse {
  groups: PermissionGroup[];
  matrix: RolePermissionMatrix;
  roles: TeamRole[];
}

export interface CurrentAccessContext {
  isSuperAdmin: boolean;
  role: TeamRole | null;
  permissions: PermissionKey[];
}
