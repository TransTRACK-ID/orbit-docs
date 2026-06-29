import { toast } from "vue3-toastify";
import type {
  NotionSyncSettings,
  NotionSyncResult,
  UpdateNotionSyncPayload,
  NotionTestConnectionResult,
} from "~/types/settings";

export function useNotionSync() {
  const settings = ref<NotionSyncSettings | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isTesting = ref(false);
  const isSyncing = ref(false);
  const appPropertyOptions = ref<string[]>([]);
  const allPropertyOptions = ref<string[]>([]);

  async function fetchSettings() {
    isLoading.value = true;
    try {
      const { data } = await $fetch<{ data: NotionSyncSettings }>("/api/settings/notion");
      settings.value = data;
    } catch (e: any) {
      if (e?.statusCode === 403) {
        settings.value = null;
      } else if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load Notion integration settings");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings(payload: UpdateNotionSyncPayload) {
    isSaving.value = true;
    try {
      const { data } = await $fetch<{ data: NotionSyncSettings }>("/api/settings/notion", {
        method: "PUT",
        body: payload,
      });
      settings.value = { ...settings.value, ...data } as NotionSyncSettings;
      toast.success("Notion settings saved");
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save Notion settings";
      toast.error(msg);
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function testConnection(payload: UpdateNotionSyncPayload) {
    isTesting.value = true;
    try {
      const { data } = await $fetch<{ data: NotionTestConnectionResult }>(
        "/api/settings/notion/test",
        { method: "POST", body: payload }
      );
      appPropertyOptions.value = data.appPropertyOptions || [];
      allPropertyOptions.value = data.allPropertyOptions || data.appPropertyOptions || [];
      if (settings.value) {
        settings.value.connected = true;
      }
      toast.success("Connected to Notion");
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Could not connect to Notion";
      toast.error(msg);
      throw e;
    } finally {
      isTesting.value = false;
    }
  }

  async function runSync() {
    isSyncing.value = true;
    try {
      const { data } = await $fetch<{ data: NotionSyncResult }>("/api/settings/notion/sync", {
        method: "POST",
      });
      if (settings.value) {
        settings.value.lastSyncStatus = data.errors.length ? "error" : "success";
        settings.value.lastSyncResult = data;
        settings.value.lastSyncAt = data.finishedAt;
      }
      const total =
        data.docsCreated + data.docsUpdated + data.releasesCreated + data.releasesUpdated;
      if (data.errors.length) {
        toast.warning(`Sync finished with ${data.errors.length} issue(s). ${total} item(s) processed.`);
      } else {
        toast.success(`Sync complete. ${total} item(s) processed.`);
      }
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Notion sync failed";
      toast.error(msg);
      throw e;
    } finally {
      isSyncing.value = false;
      await fetchSettings();
    }
  }

  return {
    settings,
    isLoading,
    isSaving,
    isTesting,
    isSyncing,
    appPropertyOptions,
    allPropertyOptions,
    fetchSettings,
    saveSettings,
    testConnection,
    runSync,
  };
}
