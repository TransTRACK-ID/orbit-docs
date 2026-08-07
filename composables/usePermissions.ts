import type { PermissionKey, RolePermissionMatrix, PermissionGroup } from "~/types/permissions";
import type { TeamRole } from "~/types/settings";

const EMPTY_MATRIX: RolePermissionMatrix = {
  viewer: {} as RolePermissionMatrix["viewer"],
  tech_writer: {} as RolePermissionMatrix["tech_writer"],
  product_manager: {} as RolePermissionMatrix["product_manager"],
  admin: {} as RolePermissionMatrix["admin"],
};

export const usePermissions = () => {
  const isSuperAdmin = useState<boolean>("rbac-is-super-admin", () => false);
  const permissions = useState<PermissionKey[]>("rbac-permissions", () => []);
  const role = useState<TeamRole | null>("rbac-role", () => null);
  const accessMatrix = useState<RolePermissionMatrix | null>("rbac-matrix", () => null);
  const accessGroups = useState<PermissionGroup[]>("rbac-access-groups", () => []);
  const accessRoles = useState<TeamRole[]>("rbac-access-roles", () => []);
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
        })
      | null;

    if (!member) {
      isSuperAdmin.value = false;
      permissions.value = [];
      role.value = null;
      return;
    }

    isSuperAdmin.value = Boolean(member.isSuperAdmin);
    permissions.value = member.permissions ?? [];
    role.value = (member.role as TeamRole) ?? null;
  }

  async function fetchAccessSettings() {
    isLoadingAccess.value = true;
    try {
      const data = await $fetch<{
        data: { matrix: RolePermissionMatrix; groups: PermissionGroup[]; roles: TeamRole[] };
      }>("/api/settings/access");
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
      const data = await $fetch<{
        data: { matrix: RolePermissionMatrix };
      }>("/api/settings/access", {
        method: "PUT",
        body: { matrix },
      });
      accessMatrix.value = data.data.matrix;
      await syncFromCurrentMember();
      return data.data.matrix;
    } finally {
      isSavingAccess.value = false;
    }
  }

  return {
    isSuperAdmin,
    permissions,
    role,
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
    EMPTY_MATRIX,
  };
};
