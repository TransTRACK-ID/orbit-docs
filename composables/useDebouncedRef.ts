import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/** Debounced mirror of a ref — use for filter/query side effects while keeping instant input binding. */
export function useDebouncedRef(source: Ref<string>, delayMs = 300): Ref<string> {
  const debounced = ref(source.value);
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(source, (value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      debounced.value = value;
    }, delayMs);
  });

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer);
      debounced.value = source.value;
    }
  });

  return debounced;
}

/** Instant local value with debounced updates to a v-model ref. */
export function useDebouncedModel(model: Ref<string | undefined>, delayMs = 300): Ref<string> {
  const input = ref(model.value ?? "");
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(input, (value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (model.value !== value) model.value = value;
    }, delayMs);
  });

  watch(model, (value) => {
    const next = value ?? "";
    if (next === input.value) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    input.value = next;
  });

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer);
      model.value = input.value;
    }
  });

  return input;
}
