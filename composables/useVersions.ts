import { toast } from "vue3-toastify";
import type { AppVersion } from "~/composables/useApps";

export interface CreateVersionPayload {
  version: string;
  status?: string;
  releaseDate?: string;
  releaseNotes?: string;
  branch?: string;
  tags?: string;
  commitHash?: string;
  approver?: string;
  ciStatus?: string;
}

export const useVersions = () => {
  const versions = ref<AppVersion[]>([]);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);

  async function fetchVersions(appId: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: AppVersion[] }>(`/api/apps/${appId}/versions`);
      versions.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load versions");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function createVersion(appId: string, payload: CreateVersionPayload) {
    isCreating.value = true;
    try {
      const data = await $fetch<{ data: AppVersion }>(`/api/apps/${appId}/versions`, {
        method: "POST",
        body: payload,
      });
      versions.value.unshift(data.data);
      toast.success(`Version ${data.data.version} created`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create version";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isCreating.value = false;
    }
  }

  async function updateVersion(appId: string, versionId: string, payload: Partial<CreateVersionPayload>) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: AppVersion }>(`/api/apps/${appId}/versions/${versionId}`, {
        method: "PUT",
        body: payload,
      });
      const idx = versions.value.findIndex((v) => v.id === versionId);
      if (idx !== -1) {
        versions.value[idx] = data.data;
      }
      toast.success(`Version ${data.data.version} updated`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update version";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isUpdating.value = false;
    }
  }

  async function deleteVersion(appId: string, versionId: string) {
    isDeleting.value = true;
    try {
      await $fetch(`/api/apps/${appId}/versions/${versionId}`, {
        method: "DELETE",
      });
      versions.value = versions.value.filter((v) => v.id !== versionId);
      toast.success("Version deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete version";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    versions,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    fetchVersions,
    createVersion,
    updateVersion,
    deleteVersion,
  };
};
