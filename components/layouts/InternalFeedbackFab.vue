<script setup lang="ts">
import type { InternalFeedbackCategory } from "~/types";

const { submitInternalFeedback, isSubmitting } = useInternalFeedback();

const isOpen = ref(false);
const showThanks = ref(false);

const category = ref<InternalFeedbackCategory>("general");
const comment = ref("");
const commentError = ref(false);

const categoryOptions = [
  { value: "general", label: "General" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "docs", label: "Documentation" },
] as const;

function openPanel() {
  isOpen.value = true;
  showThanks.value = false;
}

function closePanel() {
  isOpen.value = false;
  commentError.value = false;
}

function togglePanel() {
  if (isOpen.value) closePanel();
  else openPanel();
}

function resetForm() {
  comment.value = "";
  category.value = "general";
  commentError.value = false;
}

async function handleSubmit() {
  commentError.value = !comment.value.trim();
  if (commentError.value || isSubmitting.value) return;

  try {
    await submitInternalFeedback({
      category: category.value,
      comment: comment.value.trim(),
    });
    showThanks.value = true;
    comment.value = "";
    category.value = "general";
    window.setTimeout(() => {
      showThanks.value = false;
      closePanel();
    }, 1800);
  } catch {
    // Toast handled in composable
  }
}

function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) closePanel();
}

onMounted(() => {
  window.addEventListener("keydown", onEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onEscape);
});
</script>

<template>
  <div class="internal-feedback-fab" :class="{ 'is-open': isOpen }">
    <Transition name="fab-panel">
      <div
        v-if="isOpen"
        id="internalFeedbackPanel"
        class="fab-panel"
        role="dialog"
        aria-labelledby="internalFeedbackTitle"
        aria-modal="false"
      >
        <div class="fab-panel-header">
          <div>
            <p id="internalFeedbackTitle" class="fab-panel-title">Orbit Docs feedback</p>
            <p class="fab-panel-sub">Tell us how to improve this platform. Admins review it under Feedback.</p>
          </div>
          <button
            type="button"
            class="fab-panel-close"
            aria-label="Close feedback panel"
            @click="closePanel"
          >
            ✕
          </button>
        </div>

        <div v-if="showThanks" class="fab-thanks">
          <p>Thanks, feedback sent.</p>
        </div>

        <form v-else class="fab-form" novalidate @submit.prevent="handleSubmit">
          <div class="fab-field">
            <label for="fabCategory">Category</label>
            <select id="fabCategory" v-model="category">
              <option
                v-for="opt in categoryOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="fab-field">
            <label for="fabComment">Your feedback</label>
            <textarea
              id="fabComment"
              v-model="comment"
              rows="4"
              maxlength="2000"
              placeholder="What should we improve, fix, or clarify in Orbit Docs?"
              :class="{ 'input-error': commentError }"
              @input="commentError = false"
            />
            <span class="fab-error" :class="{ show: commentError }">Add a comment before sending</span>
          </div>

          <div class="fab-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="resetForm">
              Reset
            </button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isSubmitting">
              <span v-if="isSubmitting">Sending…</span>
              <span v-else>Send feedback</span>
            </button>
          </div>
        </form>
      </div>
    </Transition>

    <button
      type="button"
      class="fab-trigger"
      :aria-expanded="isOpen"
      aria-controls="internalFeedbackPanel"
      @click="togglePanel"
    >
      <IconsFeedback :size="18" />
      <span class="fab-trigger-label">Feedback</span>
    </button>
  </div>
</template>

<style scoped>
.internal-feedback-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

.internal-feedback-fab.is-open {
  pointer-events: auto;
}

.fab-trigger {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 20px color-mix(in oklch, var(--fg) 12%, transparent);
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-trigger:hover {
  border-color: color-mix(in oklch, var(--fg) 20%, var(--border));
  box-shadow: 0 6px 24px color-mix(in oklch, var(--fg) 14%, transparent);
}

.fab-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.internal-feedback-fab.is-open .fab-trigger {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.fab-panel {
  pointer-events: auto;
  width: min(360px, calc(100vw - 48px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 40px color-mix(in oklch, var(--fg) 14%, transparent);
  overflow: hidden;
}

.fab-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border);
}

.fab-panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}

.fab-panel-sub {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}

.fab-panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}

.fab-panel-close:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.fab-form {
  padding: 16px;
}

.fab-field {
  margin-bottom: 14px;
}

.fab-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
}

.fab-field select,
.fab-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}

.fab-field select:focus,
.fab-field textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.fab-field textarea {
  resize: vertical;
  min-height: 96px;
}

.input-error {
  border-color: oklch(55% 0.18 25) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent) !important;
}

.fab-error {
  display: none;
  margin-top: 4px;
  font-size: 12px;
  color: oklch(50% 0.16 25);
}

.fab-error.show {
  display: block;
}

.fab-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.fab-thanks {
  padding: 28px 16px;
  text-align: center;
}

.fab-thanks p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
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
  background: transparent;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  color: var(--muted);
}

.btn-ghost:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 4%, transparent);
}

.fab-panel-enter-active,
.fab-panel-leave-active {
  transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-panel-enter-from,
.fab-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .internal-feedback-fab {
    right: 16px;
    bottom: 16px;
  }

  .fab-trigger-label {
    display: none;
  }

  .fab-trigger {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fab-trigger,
  .fab-panel-enter-active,
  .fab-panel-leave-active {
    transition: none !important;
  }
}
</style>
