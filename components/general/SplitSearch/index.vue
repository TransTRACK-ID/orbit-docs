<script setup lang="ts">
defineProps<{
  placeholder?: string;
  /** Accessible name for the input and the submit button. */
  label?: string;
}>();

const model = defineModel<string>({ default: "" });

const SEARCH_DEBOUNCE_MS = 300;
const input = useDebouncedModel(model, SEARCH_DEBOUNCE_MS);

/** Apply the query immediately instead of waiting for the debounce. */
function submit() {
  model.value = input.value;
}
</script>

<template>
  <form class="split-search" role="search" @submit.prevent="submit">
    <slot name="prefix" />
    <input
      v-model="input"
      type="text"
      class="split-search__input"
      enterkeyhint="search"
      :placeholder="placeholder"
      :aria-label="label || placeholder"
    />
    <button type="submit" class="split-search__submit" :aria-label="label || 'Search'">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
        <path d="M20 20L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </form>
</template>

<style scoped>
.split-search {
  --ms-trigger-radius: 8px 0 0 8px;
  display: flex;
  align-items: stretch;
  flex: 1 1 360px;
  min-width: 0;
  max-width: 518px;
}

.split-search__input {
  flex: 1;
  min-width: 0;
  min-height: 39px;
  margin-left: -1px;
  padding: 8px 10px;
  border: 1px solid var(--control-border);
  border-radius: 0;
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}

.split-search__input::placeholder {
  color: var(--muted);
}

.split-search__input:focus {
  position: relative;
  z-index: 1;
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.split-search__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  margin-left: -1px;
  border: 1px solid var(--accent-strong);
  border-radius: 0 8px 8px 0;
  background: var(--accent-strong);
  color: var(--surface);
  cursor: pointer;
  transition: background 0.15s ease;
}

.split-search__submit:hover {
  background: color-mix(in oklch, var(--accent-strong) 88%, black);
}

.split-search__submit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .split-search {
    flex-basis: auto;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .split-search__submit {
    transition: none !important;
  }
}
</style>
