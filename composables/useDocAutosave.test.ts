import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useDocAutosave } from "./useDocAutosave";

function mountAutosave(options: Parameters<typeof useDocAutosave>[0]) {
  let api: ReturnType<typeof useDocAutosave> | null = null;
  const Comp = defineComponent({
    setup() {
      api = useDocAutosave(options);
      return () => null;
    },
  });
  mount(Comp);
  return api!;
}

describe("useDocAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces saves until content changes settle", async () => {
    const docId = ref("doc-1");
    const enabled = ref(true);
    const content = ref("Hello");
    const save = vi.fn().mockResolvedValue(undefined);

    const { scheduleSave, markClean } = mountAutosave({
      docId,
      enabled,
      getPayload: () => ({ title: "Title", content: content.value }),
      save,
      debounceMs: 1000,
    });

    markClean();
    content.value = "Hello world";
    scheduleSave();

    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    await vi.runOnlyPendingTimersAsync();
    await nextTick();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      "doc-1",
      { title: "Title", content: "Hello world" },
      { silent: true }
    );
  });

  it("does not schedule saves when disabled", async () => {
    const docId = ref("doc-1");
    const enabled = ref(false);
    const content = ref("Hello");
    const save = vi.fn().mockResolvedValue(undefined);

    const { scheduleSave, markClean } = mountAutosave({
      docId,
      enabled,
      getPayload: () => ({ title: "Title", content: content.value }),
      save,
      debounceMs: 500,
    });

    markClean();
    content.value = "Changed";
    scheduleSave();

    vi.advanceTimersByTime(500);
    await nextTick();

    expect(save).not.toHaveBeenCalled();
  });
});
