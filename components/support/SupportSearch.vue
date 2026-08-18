<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const inputId = useId();

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
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
      :value="modelValue"
      :placeholder="placeholder || 'Search all products'"
      autocomplete="off"
      @input="onInput"
    />
  </div>
</template>
