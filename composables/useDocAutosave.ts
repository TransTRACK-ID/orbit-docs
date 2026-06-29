import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { CreateDocPayload } from "~/composables/useDocs";

export type DocAutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface UseDocAutosaveOptions {
  docId: Ref<string | undefined>;
  enabled: Ref<boolean>;
  getPayload: () => CreateDocPayload;
  save: (id: string, payload: CreateDocPayload, options?: { silent?: boolean }) => Promise<unknown>;
  debounceMs?: number;
}

export function useDocAutosave({
  docId,
  enabled,
  getPayload,
  save,
  debounceMs = 2000,
}: UseDocAutosaveOptions) {
  const saveState = ref<DocAutosaveState>("idle");
  const isDirty = ref(false);

  let savedSnapshot = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  function buildSnapshot(): string {
    return JSON.stringify(getPayload());
  }

  function hasPendingChanges(): boolean {
    return buildSnapshot() !== savedSnapshot;
  }

  function markClean() {
    savedSnapshot = buildSnapshot();
    isDirty.value = false;
    if (saveState.value !== "saving") {
      saveState.value = "idle";
    }
  }

  function cancelScheduledSave() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function scheduleSave() {
    if (!enabled.value || !docId.value) return;

    if (!hasPendingChanges()) {
      isDirty.value = false;
      if (saveState.value === "pending") {
        saveState.value = "idle";
      }
      return;
    }

    isDirty.value = true;
    saveState.value = "pending";
    cancelScheduledSave();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void flushSave({ silent: true });
    }, debounceMs);
  }

  async function flushSave(options: { silent?: boolean } = { silent: true }) {
    if (inFlight) {
      await inFlight;
    }
    if (!enabled.value || !docId.value || !hasPendingChanges()) {
      return;
    }

    cancelScheduledSave();

    inFlight = (async () => {
      saveState.value = "saving";
      try {
        await save(docId.value!, getPayload(), options);
        savedSnapshot = buildSnapshot();
        isDirty.value = false;
        saveState.value = "saved";
      } catch {
        saveState.value = "error";
        isDirty.value = true;
        throw new Error("Autosave failed");
      } finally {
        inFlight = null;
      }
    })();

    await inFlight;
  }

  watch(enabled, (active) => {
    if (!active) {
      cancelScheduledSave();
    }
  });

  onBeforeUnmount(() => {
    cancelScheduledSave();
  });

  return {
    saveState,
    isDirty,
    markClean,
    scheduleSave,
    flushSave,
    cancelScheduledSave,
    hasPendingChanges,
  };
}
