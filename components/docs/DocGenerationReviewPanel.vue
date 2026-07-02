<script setup lang="ts">
import type { GenerationReviewStatus } from "~/composables/useDocGenerationCollaboration";

const props = defineProps<{
  docKey: string;
  docLabel: string;
  reviewStatus: GenerationReviewStatus;
  comments: Array<{
    id: string;
    authorName: string;
    body: string;
    quote: string | null;
    status: "open" | "resolved";
    createdAt: string | null;
  }>;
  isLoading?: boolean;
  isSaving?: boolean;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:reviewStatus", status: GenerationReviewStatus): void;
  (e: "add-comment", payload: { text: string; quote: string | null }): void;
  (e: "resolve-comment", commentId: string): void;
  (e: "reopen-comment", commentId: string): void;
}>();

const reviewOptions: { value: GenerationReviewStatus; label: string }[] = [
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes" },
];

const draft = ref("");
const quote = ref<string | null>(null);

function formatWhen(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function submitComment() {
  const text = draft.value.trim();
  if (!text) return;
  emit("add-comment", { text, quote: quote.value });
  draft.value = "";
  quote.value = null;
}

function setQuoteFromSelection() {
  const text = window.getSelection()?.toString().trim();
  quote.value = text ? text.slice(0, 500) : null;
}

watch(
  () => props.docKey,
  () => {
    draft.value = "";
    quote.value = null;
  }
);
</script>

<template>
  <aside class="review-panel" aria-label="Document review">
    <div class="review-panel-head">
      <h3>Review</h3>
      <span class="review-doc-label">{{ docLabel }}</span>
    </div>

    <div v-if="!readonly" class="review-status-row">
      <span class="review-status-label">Status</span>
      <div class="review-status-options" role="radiogroup" aria-label="Review status">
        <button
          v-for="opt in reviewOptions"
          :key="opt.value"
          type="button"
          class="review-status-btn"
          :class="{ active: reviewStatus === opt.value, [`status-${opt.value}`]: true }"
          :aria-pressed="reviewStatus === opt.value"
          :disabled="isSaving"
          @click="emit('update:reviewStatus', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div v-if="!readonly" class="review-compose">
      <label class="sr-only" for="review-comment">Add a comment</label>
      <textarea
        id="review-comment"
        v-model="draft"
        rows="3"
        placeholder="Leave feedback on this document…"
        :disabled="isSaving"
      />
      <div v-if="quote" class="review-quote">
        <span class="review-quote-label">Quoted</span>
        <p>{{ quote }}</p>
        <button type="button" class="btn btn-ghost btn-xs" @click="quote = null">Clear</button>
      </div>
      <div class="review-compose-actions">
        <button type="button" class="btn btn-ghost btn-sm" :disabled="isSaving" @click="setQuoteFromSelection">
          Quote selection
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="isSaving || !draft.trim()"
          @click="submitComment"
        >
          {{ isSaving ? "Saving…" : "Add comment" }}
        </button>
      </div>
    </div>

    <div class="review-comments">
      <p v-if="isLoading" class="review-empty">Loading comments…</p>
      <p v-else-if="comments.length === 0" class="review-empty">No comments on this document yet.</p>
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="review-comment"
        :class="{ resolved: comment.status === 'resolved' }"
      >
        <header class="review-comment-head">
          <strong>{{ comment.authorName }}</strong>
          <time>{{ formatWhen(comment.createdAt) }}</time>
        </header>
        <blockquote v-if="comment.quote" class="review-comment-quote">{{ comment.quote }}</blockquote>
        <p class="review-comment-body">{{ comment.body }}</p>
        <div v-if="!readonly" class="review-comment-actions">
          <button
            v-if="comment.status === 'open'"
            type="button"
            class="btn btn-ghost btn-xs"
            @click="emit('resolve-comment', comment.id)"
          >
            Resolve
          </button>
          <button
            v-else
            type="button"
            class="btn btn-ghost btn-xs"
            @click="emit('reopen-comment', comment.id)"
          >
            Reopen
          </button>
        </div>
      </article>
    </div>
  </aside>
</template>

<style scoped>
.review-panel {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: color-mix(in oklch, var(--fg) 2%, var(--surface));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.review-panel-head {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
}

.review-panel-head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.review-doc-label {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.review-status-row {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.review-status-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.review-status-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.review-status-btn {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
}

.review-status-btn.active {
  color: var(--fg);
  border-color: color-mix(in oklch, var(--fg) 18%, var(--border));
  background: color-mix(in oklch, var(--fg) 5%, var(--surface));
}

.review-status-btn.status-approved.active {
  color: oklch(45% 0.12 145);
  border-color: color-mix(in oklch, oklch(60% 0.18 145) 35%, var(--border));
  background: color-mix(in oklch, oklch(60% 0.18 145) 10%, var(--surface));
}

.review-status-btn.status-changes_requested.active {
  color: oklch(50% 0.14 25);
  border-color: color-mix(in oklch, oklch(55% 0.16 25) 35%, var(--border));
  background: color-mix(in oklch, oklch(55% 0.16 25) 10%, var(--surface));
}

.review-compose {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-compose textarea {
  width: 100%;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  resize: vertical;
}

.review-quote {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--fg) 4%, var(--surface));
  font-size: 12px;
}

.review-quote-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 4px;
}

.review-quote p {
  margin: 0 0 6px;
  color: var(--fg);
  line-height: 1.4;
}

.review-compose-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.review-comments {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-empty {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  padding: 16px 0;
}

.review-comment {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.review-comment.resolved {
  opacity: 0.72;
}

.review-comment-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.review-comment-head strong {
  color: var(--fg);
}

.review-comment-head time {
  color: var(--muted);
  white-space: nowrap;
}

.review-comment-quote {
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.review-comment-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--fg);
  white-space: pre-wrap;
}

.review-comment-actions {
  margin-top: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-ghost {
  border-color: transparent;
}

.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
}

.btn-sm {
  padding: 5px 10px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 960px) {
  .review-panel {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 360px;
  }
}
</style>
