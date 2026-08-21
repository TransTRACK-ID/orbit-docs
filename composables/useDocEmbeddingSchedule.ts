import { toast } from "vue3-toastify";

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
    interval: "hourly" | "daily";
  };
  semanticSearchEnabled: boolean;
  hasApiKey: boolean;
}

export function useDocEmbeddingSchedule(appId: MaybeRef<string>) {
  const settings = ref<DocEmbeddingScheduleSettings | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isRunning = ref(false);

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
        toast.error("Gagal memuat pengaturan index semantik");
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
      const msg = e?.data?.message || e?.message || "Gagal menyimpan pengaturan index semantik";
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
      await $fetch(`/api/apps/${id}/embedding-schedule/run`, { method: "POST" });
      await fetchSchedule();
      toast.success("Index semantik selesai dijalankan");
    } catch (e: any) {
      toast.error(e?.data?.message || "Gagal menjalankan index semantik");
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
