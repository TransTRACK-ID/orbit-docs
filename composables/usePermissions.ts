import type {
  AccessSettingsResponse,
  PermissionKey,
  RoleDefinition,
  RolePermissionMatrix,
  PermissionGroup,
} from "~/types/permissions";

export const usePermissions = () => {
  const isSuperAdmin = useState<boolean>("rbac-is-super-admin", () => false);
  const permissions = useState<PermissionKey[]>("rbac-permissions", () => []);
  const role = useState<string | null>("rbac-role", () => null);
  const roleName = useState<string | null>("rbac-role-name", () => null);
  const roleLevel = useState<number>("rbac-role-level", () => 0);
  const accessMatrix = useState<RolePermissionMatrix | null>("rbac-matrix", () => null);
  const accessGroups = useState<PermissionGroup[]>("rbac-access-groups", () => []);
  const accessRoles = useState<RoleDefinition[]>("rbac-access-roles", () => []);
  const isLoadingAccess = ref(false);
  const isSavingAccess = ref(false);

  function can(permission: PermissionKey): boolean {
    if (isSuperAdmin.value) return true;
    return permissions.value.includes(permission);
  }

  function canAny(...keys: PermissionKey[]): boolean {
    return keys.some((key) => can(key));
  }

  async function syncFromCurrentMember() {
    const { currentMember, fetchCurrentMember } = useSettings();
    await fetchCurrentMember();
    const member = currentMember.value as
      | (typeof currentMember.value & {
          isSuperAdmin?: boolean;
          permissions?: PermissionKey[];
          roleName?: string | null;
          roleLevel?: number;
        })
      | null;

    if (!member) {
      isSuperAdmin.value = false;
      permissions.value = [];
      role.value = null;
      roleName.value = null;
      roleLevel.value = 0;
      return;
    }

    isSuperAdmin.value = Boolean(member.isSuperAdmin);
    permissions.value = member.permissions ?? [];
    role.value = member.role ?? null;
    roleName.value = member.roleName ?? null;
    roleLevel.value = member.roleLevel ?? 0;
  }

  async function fetchAccessSettings() {
    isLoadingAccess.value = true;
    try {
      const data = await $fetch<{ data: AccessSettingsResponse }>("/api/settings/access");
      accessMatrix.value = data.data.matrix;
      accessGroups.value = data.data.groups;
      accessRoles.value = data.data.roles;
      return data.data;
    } finally {
      isLoadingAccess.value = false;
    }
  }

  async function fetchAccessMatrix() {
    const data = await fetchAccessSettings();
    return data?.matrix ?? null;
  }

  async function saveAccessMatrix(matrix: RolePermissionMatrix) {
    isSavingAccess.value = true;
    try {
      const data = await $fetch<{ data: AccessSettingsResponse }>("/api/settings/access", {
        method: "PUT",
        body: { matrix },
      });
      accessMatrix.value = data.data.matrix;
      if (data.data.groups) accessGroups.value = data.data.groups;
      if (data.data.roles) accessRoles.value = data.data.roles;
      await syncFromCurrentMember();
      return data.data.matrix;
    } finally {
      isSavingAccess.value = false;
    }
  }

  async function createRole(payload: {
    slug: string;
    name: string;
    description?: string | null;
    level?: number;
    cloneFrom?: string | null;
  }) {
    const data = await $fetch<{ data: RoleDefinition }>("/api/settings/roles", {
      method: "POST",
      body: payload,
    });
    await fetchAccessSettings();
    return data.data;
  }

  async function updateRole(
    slug: string,
    payload: { name?: string; description?: string | null; level?: number },
  ) {
    const data = await $fetch<{ data: RoleDefinition }>(`/api/settings/roles/${slug}`, {
      method: "PUT",
      body: payload,
    });
    await fetchAccessSettings();
    return data.data;
  }

  async function deleteRole(slug: string) {
    const data = await $fetch<{ success: boolean }>(`/api/settings/roles/${slug}`, {
      method: "DELETE",
    });
    await fetchAccessSettings();
    return data;
  }

  function roleNameFor(slug: string | null | undefined): string {
    if (!slug) return "";
    return accessRoles.value.find((r) => r.slug === slug)?.name ?? slug;
  }

  function rolePillClassFor(slug: string | null | undefined): string {
    const level = accessRoles.value.find((r) => r.slug === slug)?.level ?? 0;
    if (level >= 3) return "pill-green";
    if (level >= 1) return "pill-blue";
    return "pill-amber";
  }

  return {
    isSuperAdmin,
    permissions,
    role,
    roleName,
    roleLevel,
    accessMatrix,
    accessGroups,
    accessRoles,
    isLoadingAccess,
    isSavingAccess,
    can,
    canAny,
    syncFromCurrentMember,
    fetchAccessSettings,
    fetchAccessMatrix,
    saveAccessMatrix,
    createRole,
    updateRole,
    deleteRole,
    roleNameFor,
    rolePillClassFor,
  };
};
