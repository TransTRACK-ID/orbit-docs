<script setup lang="ts">
interface Props {
  appId: string;
  repoCount?: number;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "generate", payload?: { cursorModel?: string; scope?: "product" | "wiki" }): void;
}>();

const hasRepos = computed(() => (props.repoCount ?? 0) > 0);

// Agent config from public runtime config
const config = useRuntimeConfig().public;
const isCursor = computed(() => config.docAgent === "cursor");

const selectedModel = ref<string>((config.cursorModel as string) || "auto");

function submit(scope: "product" | "wiki") {
  if (!hasRepos.value) return;
  const payload: { cursorModel?: string; scope: "product" | "wiki" } = { scope };
  if (isCursor.value) {
    payload.cursorModel = selectedModel.value;
  }
  emit("generate", payload);
}
</script>

<template>
  <div class="doc-gen-form">
    <p class="form-hint">
      <strong>Product docs</strong> — Generates SRS, FSD, Git Snapshot, and SDD across
      repositories (written back via Pull Request when an access token is set).
    </p>
    <p class="form-hint">
      <strong>Wiki site</strong> — Generates a multi-page internal wiki (overview + subsystem
      pages with source file links) as a draft doc site. Browse at <code>/wiki/{site-slug}</code>.
    </p>

    <p v-if="!hasRepos" class="empty-hint">
      Add at least one repository above before generating.
    </p>

    <div class="doc-gen-actions">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="disabled || !hasRepos"
        @click="submit('product')"
      >
        <span v-if="disabled">Generating...</span>
        <span v-else>Generate product docs</span>
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="disabled || !hasRepos"
        @click="submit('wiki')"
      >
        <span v-if="disabled">Generating...</span>
        <span v-else>Generate wiki site</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.doc-gen-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.doc-gen-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.form-hint {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.form-hint code {
  font-size: 12px;
  font-family: var(--font-mono);
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
  width: 100%;
  max-width: 320px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}

.select {
  width: 100%;
}
</style>
