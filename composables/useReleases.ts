import { toast } from "vue3-toastify";
import type { ReleaseItem, CreateReleasePayload } from "~/types";

export type { ReleaseItem, CreateReleasePayload } from "~/types";

export const useReleases = () => {
  const releases = ref<ReleaseItem[]>([]);
  const release = ref<ReleaseItem | null>(null);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);

  async function fetchReleases(query?: { search?: string; app?: string; limit?: number }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem[] }>("/api/releases", {
        query: query || undefined,
      });
      releases.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load releases");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchRelease(id: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem }>(`/api/releases/${id}`);
      release.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load release");
      }
      console.error(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createRelease(payload: CreateReleasePayload) {
    isCreating.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem }>("/api/releases", {
        method: "POST",
        body: payload,
      });
      releases.value.unshift(data.data);
      toast.success("Release created");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create release";
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

  async function updateRelease(id: string, payload: Partial<CreateReleasePayload>) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem }>(`/api/releases/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = releases.value.findIndex((r) => r.id === id);
      if (idx !== -1) {
        releases.value[idx] = data.data;
      }
      if (release.value?.id === id) {
        release.value = data.data;
      }
      toast.success("Release updated");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update release";
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

  async function deleteRelease(id: string) {
    isDeleting.value = true;
    try {
      await $fetch(`/api/releases/${id}`, {
        method: "DELETE",
      });
      releases.value = releases.value.filter((r) => r.id !== id);
      toast.success("Release deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete release";
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
    releases,
    release,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    fetchReleases,
    fetchRelease,
    createRelease,
    updateRelease,
    deleteRelease,
  };
};
