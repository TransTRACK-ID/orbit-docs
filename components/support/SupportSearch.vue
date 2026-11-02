<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  debounceMs?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const inputId = useId();
const delayMs = computed(() => props.debounceMs ?? 300);

const localValue = ref(props.modelValue);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (value) => {
    if (value === localValue.value) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    localValue.value = value;
  },
);

function scheduleEmit(value: string) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (props.modelValue !== value) emit("update:modelValue", value);
  }, delayMs.value);
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  localValue.value = value;
  scheduleEmit(value);
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer);
    if (props.modelValue !== localValue.value) {
      emit("update:modelValue", localValue.value);
    }
  }
});
</script>

<template>
  <div class="support-search-wrap">
    <svg
      class="support-search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
    </svg>
    <input
      :id="inputId"
      class="support-search"
      type="search"
      :value="localValue"
      :placeholder="placeholder || 'Search all products'"
      autocomplete="off"
      @input="onInput"
    />
  </div>
</template>
