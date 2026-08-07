import type { TeamRole } from "~/types/settings";
import type { PermissionGroup, PermissionKey, RolePermissionMatrix } from "~/types/permissions";

export const TEAM_ROLES: TeamRole[] = [
  "viewer",
  "tech_writer",
  "product_manager",
  "admin",
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "apps",
    label: "Apps",
    permissions: [
      { key: "apps:read", label: "View", description: "Browse apps and activity" },
      { key: "apps:write", label: "Edit", description: "Create and update apps" },
      { key: "apps:delete", label: "Delete", description: "Remove apps" },
    ],
  },
  {
    id: "versions",
    label: "Versions",
    permissions: [
      { key: "versions:read", label: "View", description: "Browse version history" },
      { key: "versions:write", label: "Edit", description: "Create and update versions" },
      { key: "versions:publish", label: "Publish", description: "Publish or restore versions" },
    ],
  },
  {
    id: "releases",
    label: "Releases",
    permissions: [
      { key: "releases:read", label: "View", description: "Browse release notes" },
      { key: "releases:write", label: "Edit", description: "Create and update releases" },
      { key: "releases:publish", label: "Publish", description: "Publish releases" },
    ],
  },
  {
    id: "changelogs",
    label: "Changelogs",
    permissions: [
      { key: "changelogs:read", label: "View", description: "Browse changelogs" },
      { key: "changelogs:write", label: "Edit", description: "Create and update changelogs" },
    ],
  },
  {
    id: "docs",
    label: "Docs",
    permissions: [
      { key: "docs:read", label: "View", description: "Browse documentation" },
      { key: "docs:write", label: "Edit", description: "Create and update docs" },
      { key: "docs:publish", label: "Publish", description: "Publish or archive docs" },
    ],
  },
  {
    id: "doc_sites",
    label: "Doc Sites",
    permissions: [
      { key: "doc_sites:read", label: "View", description: "Browse doc sites" },
      { key: "doc_sites:write", label: "Edit", description: "Create and configure doc sites" },
    ],
  },
  {
    id: "api_docs",
    label: "API Docs",
    permissions: [
      { key: "api_docs:read", label: "View", description: "Browse API collections" },
      { key: "api_docs:write", label: "Edit", description: "Create and update API docs" },
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    permissions: [
      { key: "feedback:read", label: "View", description: "Browse public feedback" },
      { key: "feedback:manage", label: "Manage", description: "Update status and delete feedback" },
    ],
  },
  {
    id: "internal_feedback",
    label: "Internal Feedback",
    permissions: [
      {
        key: "internal_feedback:read",
        label: "View",
        description: "Browse internal product feedback",
      },
      {
        key: "internal_feedback:manage",
        label: "Manage",
        description: "Triage and resolve internal feedback",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    permissions: [
      { key: "settings:read", label: "View", description: "Open workspace settings" },
      { key: "settings:write", label: "Edit", description: "Update workspace configuration" },
    ],
  },
  {
    id: "team",
    label: "Team",
    permissions: [
      { key: "team:read", label: "View", description: "See team members" },
      { key: "team:invite", label: "Invite", description: "Invite new members" },
      { key: "team:manage", label: "Manage", description: "Update roles and remove members" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    permissions: [
      { key: "integrations:read", label: "View", description: "View integration settings" },
      { key: "integrations:write", label: "Edit", description: "Configure integrations" },
    ],
  },
  {
    id: "api_keys",
    label: "API Keys",
    permissions: [
      { key: "api_keys:read", label: "View", description: "View API keys" },
      { key: "api_keys:write", label: "Edit", description: "Rotate and revoke API keys" },
    ],
  },
  {
    id: "doc_generation",
    label: "Doc Generation",
    permissions: [
      { key: "doc_generation:read", label: "View", description: "View generation jobs" },
      { key: "doc_generation:run", label: "Run", description: "Trigger doc generation" },
    ],
  },
  {
    id: "adrs",
    label: "Architectural Decisions",
    permissions: [
      { key: "adrs:read", label: "View", description: "Open Settings → Architectural Decisions" },
      { key: "adrs:write", label: "Manage", description: "Create and edit ADRs, change adr_status" },
      { key: "adrs:publish", label: "Publish", description: "Publish or archive ADR documents" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

function keys(...items: PermissionKey[]): Record<PermissionKey, boolean> {
  return ALL_PERMISSION_KEYS.reduce(
    (acc, key) => {
      acc[key] = items.includes(key);
      return acc;
    },
    {} as Record<PermissionKey, boolean>
  );
}

export const DEFAULT_ROLE_PERMISSION_MATRIX: RolePermissionMatrix = {
  viewer: keys(
    "apps:read",
    "versions:read",
    "releases:read",
    "changelogs:read",
    "docs:read",
    "doc_sites:read",
    "api_docs:read",
    "feedback:read",
    "settings:read",
    "team:read"
  ),
  tech_writer: keys(
    "apps:read",
    "versions:read",
    "releases:read",
    "changelogs:read",
    "changelogs:write",
    "docs:read",
    "docs:write",
    "doc_sites:read",
    "api_docs:read",
    "feedback:read",
    "settings:read",
    "team:read",
    "doc_generation:read",
    "doc_generation:run"
  ),
  product_manager: keys(
    "apps:read",
    "apps:write",
    "versions:read",
    "versions:write",
    "versions:publish",
    "releases:read",
    "releases:write",
    "releases:publish",
    "changelogs:read",
    "changelogs:write",
    "docs:read",
    "docs:write",
    "docs:publish",
    "doc_sites:read",
    "doc_sites:write",
    "api_docs:read",
    "api_docs:write",
    "feedback:read",
    "feedback:manage",
    "settings:read",
    "team:read",
    "team:invite",
    "doc_generation:read",
    "doc_generation:run"
  ),
  admin: keys(
    "apps:read",
    "apps:write",
    "apps:delete",
    "versions:read",
    "versions:write",
    "versions:publish",
    "releases:read",
    "releases:write",
    "releases:publish",
    "changelogs:read",
    "changelogs:write",
    "docs:read",
    "docs:write",
    "docs:publish",
    "doc_sites:read",
    "doc_sites:write",
    "api_docs:read",
    "api_docs:write",
    "feedback:read",
    "feedback:manage",
    "settings:read",
    "settings:write",
    "team:read",
    "team:invite",
    "team:manage",
    "integrations:read",
    "integrations:write",
    "api_keys:read",
    "api_keys:write",
    "doc_generation:read",
    "doc_generation:run",
    "adrs:read",
    "adrs:write",
    "adrs:publish"
  ),
};

export function mergeMatrixWithDefaults(
  stored: Partial<Record<TeamRole, Partial<Record<PermissionKey, boolean>>>>
): RolePermissionMatrix {
  const merged = {} as RolePermissionMatrix;

  for (const role of TEAM_ROLES) {
    merged[role] = { ...DEFAULT_ROLE_PERMISSION_MATRIX[role] };
    const overrides = stored[role];
    if (!overrides) continue;
    for (const key of ALL_PERMISSION_KEYS) {
      if (typeof overrides[key] === "boolean") {
        merged[role][key] = overrides[key]!;
      }
    }
  }

  return merged;
}

export function listPermissionsForRole(
  role: TeamRole,
  matrix: RolePermissionMatrix
): PermissionKey[] {
  return ALL_PERMISSION_KEYS.filter((key) => matrix[role][key]);
}

export function roleHasPermission(
  role: TeamRole,
  permission: PermissionKey,
  matrix: RolePermissionMatrix
): boolean {
  return Boolean(matrix[role]?.[permission]);
}

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/apps": "apps:read",
  "/versions": "versions:read",
  "/releases": "releases:read",
  "/changelogs": "changelogs:read",
  "/docs": "docs:read",
  "/sites": "doc_sites:read",
  "/api-docs": "api_docs:read",
  "/feedback": "feedback:read",
  "/settings": "settings:read",
  "/settings/adr": "adrs:read",
};
