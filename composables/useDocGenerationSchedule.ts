import { toast } from "vue3-toastify";

export interface DocGenerationScheduleSettings {
  scheduleEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunJobId: string | null;
  workspaceSchedule: {
    enabled: boolean;
    interval: "hourly" | "daily";
  };
}

export function useDocGenerationSchedule(appId: MaybeRef<string>) {
  const settings = ref<DocGenerationScheduleSettings | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);

  async function fetchSchedule() {
    const id = unref(appId);
    if (!id) return null;

    isLoading.value = true;
    try {
      const { data } = await $fetch<{ data: DocGenerationScheduleSettings }>(
        `/api/apps/${id}/generate-docs/schedule`
      );
      settings.value = data;
      return data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load scheduled sync settings");
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
      const { data } = await $fetch<{ data: DocGenerationScheduleSettings }>(
        `/api/apps/${id}/generate-docs/schedule`,
        {
          method: "PUT",
          body: { scheduleEnabled },
        }
      );
      settings.value = data;
      toast.success(
        scheduleEnabled ? "Scheduled doc sync enabled" : "Scheduled doc sync disabled"
      );
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save scheduled sync settings";
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

  return {
    settings,
    isLoading,
    isSaving,
    fetchSchedule,
    saveSchedule,
    toggleSchedule,
  };
}
