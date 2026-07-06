<script setup lang="ts">
import type { HistoryDiffResponse } from "~/types/diff";

const props = defineProps<{
  open: boolean;
  title?: string;
  isLoading?: boolean;
  error?: string | null;
  diff: HistoryDiffResponse | null;
  hasUnsavedChanges?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "update:fromId": [id: string];
  "update:toId": [id: string];
}>();

const viewMode = ref<"unified" | "split">("unified");
const fromId = ref("");
const toId = ref("");

watch(
  () => props.diff,
  (value) => {
    if (!value) return;
    fromId.value = value.from.id;
    toId.value = value.to.id;
  },
  { immediate: true },
);

function onFromChange(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  fromId.value = id;
  emit("update:fromId", id);
}

function onToChange(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  toId.value = id;
  emit("update:toId", id);
}

function formatMetadataValue(value: string | boolean | null): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value ?? "—";
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? "hidden" : "";
  },
);

onBeforeUnmount(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <div
    class="diff-overlay"
    :class="{ active: open }"
    role="dialog"
    aria-modal="true"
    aria-label="Version diff"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div class="diff-panel">
      <div class="diff-header">
        <div class="diff-header-title">
          <h2>{{ title || "Version diff" }}</h2>
          <p class="diff-subtitle">Compare historical snapshots</p>
        </div>
        <div class="diff-header-actions">
          <div class="diff-mode-toggle" role="group" aria-label="Diff view mode">
            <button
              type="button"
              class="diff-mode-btn"
              :class="{ active: viewMode === 'unified' }"
              @click="viewMode = 'unified'"
            >
              Unified
            </button>
            <button
              type="button"
              class="diff-mode-btn"
              :class="{ active: viewMode === 'split' }"
              @click="viewMode = 'split'"
            >
              Split
            </button>
          </div>
          <button type="button" class="diff-close" aria-label="Close diff" @click="emit('close')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="diff" class="diff-selectors">
        <label class="diff-select-label">
          <span>From</span>
          <select :value="fromId" class="diff-select" @change="onFromChange">
            <option v-for="version in diff.versions" :key="version.id" :value="version.id">
              {{ version.label }}
            </option>
          </select>
        </label>
        <label class="diff-select-label">
          <span>To</span>
          <select :value="toId" class="diff-select" @change="onToChange">
            <option v-for="version in diff.versions" :key="version.id" :value="version.id">
              {{ version.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="hasUnsavedChanges" class="diff-banner" role="status">
        You have unsaved changes that differ from the latest saved version.
      </div>

      <div class="diff-body">
        <div v-if="isLoading" class="diff-state">Loading diff…</div>
        <div v-else-if="error" class="diff-state diff-state-error">{{ error }}</div>
        <template v-else-if="diff">
          <div v-if="diff.metadata.length > 0" class="diff-metadata">
            <div v-for="item in diff.metadata" :key="item.field" class="diff-metadata-row">
              <span class="diff-metadata-label">{{ item.label }}</span>
              <span class="diff-metadata-value">
                {{ formatMetadataValue(item.from) }}
                <span aria-hidden="true">→</span>
                {{ formatMetadataValue(item.to) }}
              </span>
            </div>
          </div>

          <div v-if="diff.sections.length === 0 && diff.metadata.length === 0" class="diff-state">
            No differences between the selected versions.
          </div>

          <DiffSection
            v-for="section in diff.sections"
            :key="section.key"
            :section="section"
            :mode="viewMode"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklch, var(--fg) 40%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.diff-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.diff-panel {
  width: min(1100px, 100%);
  max-height: calc(100vh - 48px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 48px color-mix(in oklch, var(--fg) 16%, transparent);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(8px) scale(0.98);
  transition: transform 0.2s ease;
}

.diff-overlay.active .diff-panel {
  transform: translateY(0) scale(1);
}

.diff-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.diff-header-title h2 {
  margin: 0;
  font-size: 18px;
}

.diff-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.diff-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.diff-mode-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.diff-mode-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
}

.diff-mode-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.diff-close {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius);
}

.diff-close:hover {
  color: var(--fg);
  background: var(--surface);
}

.diff-selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.diff-select-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.diff-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  font-size: 13px;
}

.diff-banner {
  margin: 16px 24px 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in oklch, var(--accent) 30%, var(--border));
  background: var(--accent-soft);
  color: var(--fg);
  font-size: 13px;
}

.diff-body {
  padding: 16px 24px 24px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diff-state {
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.diff-state-error {
  color: #ef4444;
}

.diff-metadata {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.diff-metadata-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.diff-metadata-label {
  color: var(--muted);
  font-weight: 600;
}

.diff-metadata-value {
  color: var(--fg);
}

@media (max-width: 768px) {
  .diff-overlay {
    padding: 12px;
  }

  .diff-selectors {
    grid-template-columns: 1fr;
  }
}
</style>
