import { toast } from "vue3-toastify";

export interface CursorApiKeySettings {
  hasApiKey: boolean;
  source: "database" | "env" | "none";
}

export function useCursorApiKey() {
  const settings = ref<CursorApiKeySettings | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);

  async function fetchSettings() {
    isLoading.value = true;
    try {
      const { data } = await $fetch<{ data: CursorApiKeySettings }>(
        "/api/settings/cursor-api-key",
      );
      settings.value = data;
    } catch (e: any) {
      if (e?.statusCode === 403) {
        settings.value = null;
      } else if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load Cursor API key settings");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveApiKey(apiKey: string) {
    isSaving.value = true;
    try {
      await $fetch("/api/settings/cursor-api-key", {
        method: "PUT",
        body: { apiKey },
      });
      await fetchSettings();
      toast.success("Cursor API key saved");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save Cursor API key";
      toast.error(msg);
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    settings,
    isLoading,
    isSaving,
    fetchSettings,
    saveApiKey,
  };
}
