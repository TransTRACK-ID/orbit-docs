import type { HistoryDiffResponse } from "~/types/diff";

export function useHistoryDiff() {
  const diff = ref<HistoryDiffResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isOpen = ref(false);

  async function fetchDocDiff(docId: string, fromId: string, toId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ data: HistoryDiffResponse }>(`/api/docs/${docId}/diff`, {
        query: {
          ...(fromId ? { from: fromId } : {}),
          ...(toId ? { to: toId } : {}),
        },
      });
      diff.value = data.data;
      return data.data;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to load diff";
      diff.value = null;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchChangelogDiff(versionId: string, fromId: string, toId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ data: HistoryDiffResponse }>(`/api/versions/${versionId}/history/diff`, {
        query: {
          ...(fromId ? { from: fromId } : {}),
          ...(toId ? { to: toId } : {}),
        },
      });
      diff.value = data.data;
      return data.data;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to load diff";
      diff.value = null;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchReleaseDiff(releaseId: string, fromId: string, toId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ data: HistoryDiffResponse }>(`/api/releases/${releaseId}/diff`, {
        query: {
          ...(fromId ? { from: fromId } : {}),
          ...(toId ? { to: toId } : {}),
        },
      });
      diff.value = data.data;
      return data.data;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to load diff";
      diff.value = null;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function openDiff() {
    isOpen.value = true;
  }

  function closeDiff() {
    isOpen.value = false;
    error.value = null;
  }

  return {
    diff,
    isLoading,
    error,
    isOpen,
    fetchDocDiff,
    fetchChangelogDiff,
    fetchReleaseDiff,
    openDiff,
    closeDiff,
  };
}
