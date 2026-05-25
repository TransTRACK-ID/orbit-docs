import { toast } from "vue3-toastify";

export interface ChangelogItem {
  id: string;
  appId: string;
  versionId: string | null;
  content: string | null;
  status: "draft" | "published" | "archived";
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  appName: string;
  version: string | null;
  releaseDate: string | null;
}

export interface ChangelogHistoryEntry {
  id: string;
  changelogId: string;
  content: string | null;
  action: string;
  actor: string;
  createdAt: string | null;
}

export interface CreateChangelogPayload {
  appId: string;
  versionId?: string;
  content?: string;
  status?: string;
}

export const useChangelogs = () => {
  const changelogs = ref<ChangelogItem[]>([]);
  const changelog = ref<ChangelogItem | null>(null);
  const history = ref<ChangelogHistoryEntry[]>([]);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const isSaving = ref(false);

  async function fetchChangelogs(query?: { search?: string; app?: string; limit?: number }) {
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

  async function fetchHistory(id: string) {
    try {
      const data = await $fetch<{ data: ChangelogHistoryEntry[] }>(`/api/changelogs/${id}/history`);
      history.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load changelog history");
      }
      console.error(e);
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

  async function updateChangelog(id: string, payload: Partial<CreateChangelogPayload>) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>(`/api/changelogs/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = changelogs.value.findIndex((c) => c.id === id);
      if (idx !== -1) {
        changelogs.value[idx] = { ...changelogs.value[idx], ...data.data };
      }
      if (changelog.value?.id === id) {
        changelog.value = { ...changelog.value, ...data.data };
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

  async function saveDraft(id: string, content: string) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>(`/api/changelogs/${id}`, {
        method: "PUT",
        body: { content },
      });
      if (changelog.value?.id === id) {
        changelog.value = { ...changelog.value, ...data.data };
      }
      toast.success("Draft saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save draft";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function publishChangelog(id: string) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: ChangelogItem }>(`/api/changelogs/${id}/publish`, {
        method: "POST",
      });
      const idx = changelogs.value.findIndex((c) => c.id === id);
      if (idx !== -1) {
        changelogs.value[idx] = { ...changelogs.value[idx], ...data.data };
      }
      if (changelog.value?.id === id) {
        changelog.value = { ...changelog.value, ...data.data };
      }
      toast.success("Changelog published");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to publish changelog";
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
    history,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isSaving,
    fetchChangelogs,
    fetchChangelog,
    fetchHistory,
    createChangelog,
    updateChangelog,
    saveDraft,
    publishChangelog,
    deleteChangelog,
  };
};
