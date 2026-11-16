import { toast } from "vue3-toastify";
import type { NotionSyncInterval } from "~/types/settings";

export interface DocEmbeddingScheduleSettings {
  scheduleEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunResult: {
    indexed: number;
    skipped: number;
    failed: number;
    candidates: number;
    finishedAt: string;
  } | null;
  workspaceSchedule: {
    enabled: boolean;
    interval: NotionSyncInterval;
  };
  semanticSearchEnabled: boolean;
  hasApiKey: boolean;
}

const RUN_POLL_INTERVAL_MS = 3000;

export function useDocEmbeddingSchedule(appId: MaybeRef<string>) {
  const settings = ref<DocEmbeddingScheduleSettings | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isRunning = ref(false);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  async function fetchSchedule() {
    const id = unref(appId);
    if (!id) return null;

    isLoading.value = true;
    try {
      const { data } = await $fetch<{ data: DocEmbeddingScheduleSettings }>(
        `/api/apps/${id}/embedding-schedule`,
      );
      settings.value = data;
      return data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Couldn't load semantic index settings");
      }
      console.error(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSchedule(scheduleEnabled: boolean) {
    const id = unref(appId);
    if (!id) return null;

    isSaving.value = true;
    try {
      const { data } = await $fetch<{ data: DocEmbeddingScheduleSettings }>(
        `/api/apps/${id}/embedding-schedule`,
        {
          method: "PUT",
          body: { scheduleEnabled },
        },
      );
      settings.value = data;
      toast.success(
        scheduleEnabled
          ? "Index semantik terjadwal diaktifkan"
          : "Index semantik terjadwal dinonaktifkan",
      );
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Couldn't save semantic index settings";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      console.error(e);
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function toggleSchedule() {
    if (!settings.value) return null;
    return saveSchedule(!settings.value.scheduleEnabled);
  }

  async function runNow() {
    const id = unref(appId);
    if (!id) return null;

    isRunning.value = true;
    try {
      const { data } = await $fetch<{ data: DocEmbeddingScheduleSettings }>(
        `/api/apps/${id}/embedding-schedule/run`,
        { method: "POST" },
      );
      settings.value = data;

      // The server indexes in the background; poll until the run settles.
      let latest = data;
      while (latest.lastRunStatus === "running" && !disposed && unref(appId) === id) {
        const tick = Promise.withResolvers<void>();
        setTimeout(tick.resolve, RUN_POLL_INTERVAL_MS);
        await tick.promise;
        ({ data: latest } = await $fetch<{ data: DocEmbeddingScheduleSettings }>(
          `/api/apps/${id}/embedding-schedule`,
        ));
        if (unref(appId) === id) settings.value = latest;
      }

      if (latest.lastRunStatus === "error") {
        const failed = latest.lastRunResult?.failed ?? 0;
        toast.error(
          failed > 0
            ? `Semantic index run failed for ${failed} doc(s); see server logs`
            : "Semantic index run failed; see server logs",
        );
      } else if (latest.lastRunStatus !== "running") {
        toast.success("Semantic index run finished");
      }
    } catch (e: any) {
      toast.error(e?.data?.message || "Couldn't run the semantic index");
      throw e;
    } finally {
      isRunning.value = false;
    }
  }

  return {
    settings,
    isLoading,
    isSaving,
    isRunning,
    fetchSchedule,
    saveSchedule,
    toggleSchedule,
    runNow,
  };
}
