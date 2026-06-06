<script setup lang="ts">
interface Props {
  appId: string;
  repoUrl?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "generate", payload: { repoUrl: string }): void;
}>();

const form = reactive({
  repoUrl: props.repoUrl || "",
});

const repoUrlError = ref(false);

watch(
  () => props.repoUrl,
  (val) => {
    if (val) form.repoUrl = val;
  }
);

function submit() {
  if (!form.repoUrl.trim()) {
    repoUrlError.value = true;
    return;
  }
  repoUrlError.value = false;
  emit("generate", { repoUrl: form.repoUrl.trim() });
}
</script>

<template>
  <div class="doc-gen-form">
    <div class="form-group">
      <label for="repoUrl">Repository URL</label>
      <input
        id="repoUrl"
        v-model="form.repoUrl"
        type="url"
        placeholder="https://github.com/username/repo"
        required
        :class="{ 'input-error': repoUrlError }"
        :disabled="disabled"
        @input="repoUrlError = false"
      />
      <span class="error-msg" :class="{ show: repoUrlError }">
        Repository URL is required
      </span>
    </div>

    <button
      type="button"
      class="btn btn-primary"
      :disabled="disabled"
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
