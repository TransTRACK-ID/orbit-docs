import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useDebouncedModel, useDebouncedRef } from "./useDebouncedRef";

function mountDebouncedRef(source: ReturnType<typeof ref<string>>, delayMs?: number) {
  let debounced: ReturnType<typeof useDebouncedRef> | null = null;
  const Comp = defineComponent({
    setup() {
      debounced = useDebouncedRef(source, delayMs);
      return () => null;
    },
  });
  mount(Comp);
  return debounced!;
}

function mountDebouncedModel(model: ReturnType<typeof ref<string>>, delayMs?: number) {
  let input: ReturnType<typeof useDebouncedModel> | null = null;
  const Comp = defineComponent({
    setup() {
      input = useDebouncedModel(model, delayMs);
      return () => null;
    },
  });
  mount(Comp);
  return input!;
}

describe("useDebouncedRef", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates debounced value after the delay", async () => {
    const source = ref("");
    const debounced = mountDebouncedRef(source, 300);

    source.value = "orbit";
    await nextTick();
    expect(debounced.value).toBe("");

    vi.advanceTimersByTime(300);
    expect(debounced.value).toBe("orbit");
  });

  it("coalesces rapid typing into one debounced value", async () => {
    const source = ref("");
    const debounced = mountDebouncedRef(source, 300);

    source.value = "o";
    source.value = "or";
    source.value = "orb";
    await nextTick();

    vi.advanceTimersByTime(300);
    expect(debounced.value).toBe("orb");
  });
});

describe("useDebouncedModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces writes to the model", async () => {
    const model = ref("");
    const input = mountDebouncedModel(model, 300);

    input.value = "docs";
    await nextTick();
    expect(model.value).toBe("");

    vi.advanceTimersByTime(300);
    expect(model.value).toBe("docs");
  });

  it("syncs input when the model is cleared externally", async () => {
    const model = ref("keep");
    const input = mountDebouncedModel(model, 300);

    expect(input.value).toBe("keep");
    model.value = "";
    await nextTick();
    expect(input.value).toBe("");
  });
});
