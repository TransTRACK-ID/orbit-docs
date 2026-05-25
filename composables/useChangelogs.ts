import { toast } from "vue3-toastify";
import type { ChangelogItem, CreateChangelogPayload } from "~/types";

export type { ChangelogItem, CreateChangelogPayload } from "~/types";

export const useChangelogs = () => {
  const changelogs = ref<ChangelogItem[]>([]);
  const changelog = ref<ChangelogItem | null>(null);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);

  async function fetchChangelogs(query?: { search?: string; app?: string; status?: string; limit?: number }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem[] }>("/api/changelogs", {
        query: query || undefined,
      });
      changelogs.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load changelogs");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchChangelog(id: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>(`/api/changelogs/${id}`);
      changelog.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load changelog");
      }
      console.error(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAppChangelogs(appId: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem[] }>(`/api/apps/${appId}/changelogs`);
      changelogs.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load changelogs");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function createChangelog(payload: CreateChangelogPayload) {
    isCreating.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>("/api/changelogs", {
        method: "POST",
        body: payload,
      });
      changelogs.value.unshift(data.data);
      toast.success("Changelog created");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create changelog";
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

  async function updateChangelog(id: string, payload: Partial<CreateChangelogPayload> & { status?: "draft" | "published" }) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>(`/api/changelogs/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = changelogs.value.findIndex((c) => c.id === id);
      if (idx !== -1) {
        changelogs.value[idx] = data.data;
      }
      if (changelog.value?.id === id) {
        changelog.value = data.data;
      }
      toast.success("Changelog updated");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update changelog";
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

  async function deleteChangelog(id: string) {
    isDeleting.value = true;
    try {
      await $fetch(`/api/changelogs/${id}`, {
        method: "DELETE",
      });
      changelogs.value = changelogs.value.filter((c) => c.id !== id);
      toast.success("Changelog deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete changelog";
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
    changelogs,
    changelog,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    fetchChangelogs,
    fetchChangelog,
    fetchAppChangelogs,
    createChangelog,
    updateChangelog,
    deleteChangelog,
  };
};
