<script setup lang="ts">
interface Props {
  appId: string;
  repoCount?: number;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "generate", payload?: { cursorModel?: string }): void;
}>();

const hasRepos = computed(() => (props.repoCount ?? 0) > 0);

// Agent config from public runtime config
const config = useRuntimeConfig().public;
const isCursor = computed(() => config.docAgent === "cursor");

// Known Cursor models — kept in sync with the CLI's supported list
const cursorModels = [
  { value: "auto", label: "Auto" },
  { value: "composer-2.5", label: "Composer 2.5" },
  { value: "opus-4.8", label: "Opus 4.8" },
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "sonnet-4", label: "Sonnet 4" },
  { value: "sonnet-4-thinking", label: "Sonnet 4 (Thinking)" },
  { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  { value: "grok-4.3", label: "Grok 4.3" },
];

const selectedModel = ref<string>((config.cursorModel as string) || "auto");

function submit() {
  if (!hasRepos.value) return;
  if (isCursor.value) {
    emit("generate", { cursorModel: selectedModel.value });
  } else {
    emit("generate");
  }
}
</script>

<template>
  <div class="doc-gen-form">
    <p class="form-hint">
      Generates a product-level PRD and FSD across all repositories, plus a
      System Design Document for each repository (written back via Pull Request
      when an access token is set).
    </p>

    <div v-if="isCursor" class="form-group">
      <label for="cursor-model">Cursor Model</label>
      <select
        id="cursor-model"
        v-model="selectedModel"
        class="form-select"
        :disabled="disabled"
      >
        <option v-for="m in cursorModels" :key="m.value" :value="m.value">
          {{ m.label }}
        </option>
      </select>
      <p class="form-help">
        Select the model Cursor Agent uses. "Auto" lets Cursor choose.
      </p>
    </div>

    <p v-if="!hasRepos" class="empty-hint">
      Add at least one repository above before generating.
    </p>

    <button
      type="button"
      class="btn btn-primary"
      :disabled="disabled || !hasRepos"
      @click="submit"
    >
      <span v-if="disabled">Generating...</span>
      <span v-else>Generate Docs</span>
    </button>
  </div>
</template>

<style scoped>
.doc-gen-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.form-hint {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: oklch(50% 0.14 60);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group select {
  width: 100%;
  max-width: 280px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
}

.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-help {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.input-error {
  border-color: oklch(55% 0.18 25) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent) !important;
}

.error-msg {
  display: none;
  color: oklch(50% 0.16 25);
  font-size: 12px;
}

.error-msg.show {
  display: block;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
}
</style>
