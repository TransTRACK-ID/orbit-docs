<script setup lang="ts">
import { nextTick } from "vue";
import DocOutline from "~/components/docs/DocOutline.vue";
import { renderMarkdown } from "~/composables/useMarkdown";
import {
  buildOutlineFromMarkdown,
  useDocOutline,
  useMarkdownCopyHandler,
} from "~/composables/useDocOutline";
import type { PublishedDocDetail } from "~/composables/usePublishedDocs";

definePageMeta({
  layout: false,
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const { fetchPublishedDoc } = usePublishedDocs();
const { submitDocFeedback, checkDocFeedbackStatus, isSubmitting, getFeedbackVisitorId } =
  useFeedback();

const docId = computed(() => route.params.id as string);
const doc = ref<PublishedDocDetail | null>(null);
const isLoading = ref(true);
const error = ref("");
const feedbackGiven = ref(false);
const feedbackHelpful = ref<boolean | null>(null);
const showCommentForm = ref(false);
const feedbackComment = ref("");
const visitorId = ref("");

const toastMsg = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const chatOpen = ref(false);

const contentRef = ref<HTMLElement | null>(null);

function showToast(msg: string) {
  toastMsg.value = msg;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}

/* ── Rendered content ──────────────────────────────────────────── */
const renderedHtml = computed(() => {
  if (!doc.value?.content) return "";
  return renderMarkdown(doc.value.content);
});

const outlineItems = computed(() =>
  doc.value?.content ? buildOutlineFromMarkdown(doc.value.content) : [],
);

const { activeSlug, scrollToSection, scrollToTop, refreshScrollSpy, teardownScrollSpy } =
  useDocOutline(contentRef);
const { handleContentClick } = useMarkdownCopyHandler(showToast);

onMounted(async () => {
  if (!docId.value) {
    error.value = "No document ID provided";
    isLoading.value = false;
    return;
  }
  try {
    const data = await fetchPublishedDoc(docId.value);
    doc.value = data;
    visitorId.value = getFeedbackVisitorId();
    if (visitorId.value) {
      const status = await checkDocFeedbackStatus(docId.value, visitorId.value);
      if (status.submitted && status.feedback) {
        feedbackGiven.value = true;
        feedbackHelpful.value = status.feedback.helpful;
      }
    }
    nextTick(() => {
      if (route.hash) {
        const hash = route.hash.slice(1);
        if (hash === "docFeedback") {
          const container = contentRef.value;
          const feedbackEl = document.getElementById("docFeedback");
          if (container && feedbackEl) {
            const top = feedbackEl.offsetTop - container.offsetTop;
            container.scrollTo({ top, behavior: "smooth" });
          }
        } else {
          scrollToSection(hash);
        }
      }
    });
  } catch (e: any) {
    error.value = e?.data?.message || "Documentation not found";
  } finally {
    isLoading.value = false;
  }
});

watch(renderedHtml, () => {
  if (!doc.value?.content || isLoading.value) return;
  nextTick(() => refreshScrollSpy());
});

onBeforeUnmount(() => {
  teardownScrollSpy();
  if (toastTimer) clearTimeout(toastTimer);
});

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

async function voteFeedback(positive: boolean) {
  if (feedbackGiven.value || isSubmitting.value) return;

  if (!positive) {
    showCommentForm.value = true;
    return;
  }

  await submitFeedback(true);
}

async function submitFeedback(positive: boolean, comment?: string) {
  if (feedbackGiven.value || isSubmitting.value) return;

  try {
    await submitDocFeedback(docId.value, {
      helpful: positive,
      comment: comment || undefined,
      visitorId: visitorId.value || getFeedbackVisitorId(),
    });
    feedbackGiven.value = true;
    feedbackHelpful.value = positive;
    showCommentForm.value = false;
    feedbackComment.value = "";
    showToast(positive ? "Thanks for the feedback!" : "We will improve this section");
  } catch {
    showToast("Failed to submit feedback");
  }
}

async function submitNegativeFeedback() {
  await submitFeedback(false, feedbackComment.value.trim() || undefined);
}

function cancelCommentForm() {
  showCommentForm.value = false;
  feedbackComment.value = "";
}
</script>

<template>
  <div class="doc-reader-page page-root">
    <div v-if="isLoading" class="loading-shell">
      <div class="loading-sidebar">
        <div class="sk-header">
          <div class="sk-title" />
          <div class="sk-meta" />
        </div>
      </div>
      <div class="loading-content">
        <div class="sk-body">
          <div class="sk-badge-row">
            <div class="sk-badge" />
            <div class="sk-meta-text" />
          </div>
          <div class="sk-paragraph" />
          <div class="sk-paragraph" style="width: 92%;" />
          <div class="sk-paragraph" style="width: 85%;" />
          <div class="sk-heading" />
          <div class="sk-paragraph" />
          <div class="sk-paragraph" style="width: 95%;" />
          <div class="sk-code-block" />
          <div class="sk-heading" />
          <div class="sk-paragraph" />
          <div class="sk-paragraph" style="width: 90%;" />
        </div>
      </div>
      <div class="loading-outline">
        <div class="sk-outline-title" />
        <div v-for="n in 6" :key="n" class="sk-nav-item" :style="{ width: `${60 + (n % 3) * 12}%` }" />
      </div>
    </div>

    <div v-else-if="error" class="error-shell">
      <div class="error-body">
        <h1>{{ error }}</h1>
        <p>The documentation you are looking for could not be loaded.</p>
      </div>
    </div>

    <div v-else-if="doc" class="doc-shell">
      <aside class="doc-sidebar">
        <button type="button" class="doc-sidebar-header" @click="scrollToTop">
          <div class="doc-sidebar-title">{{ doc.app?.name || doc.title }}</div>
          <div class="doc-sidebar-meta num">
            <span v-if="doc.version?.version">v{{ doc.version.version }}</span>
            <span v-if="doc.updatedAt">
              {{ doc.version?.version ? " · " : "" }}Updated
              {{ new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
            </span>
          </div>
        </button>
      </aside>

      <main
        ref="contentRef"
        class="doc-content"
        :class="{
          'doc-content--dock-pad': !feedbackGiven,
          'doc-content--dock-pad-expanded': showCommentForm,
        }"
      >
        <article id="docContent" class="doc-body">
          <div class="flex-gap-sm doc-body-badges">
            <span class="pill pill-green">Latest</span>
            <span v-if="doc.updatedAt" class="meta-label num">
              Updated {{ new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
            </span>
          </div>

          <MermaidHtml
            class="markdown-content markdown-body"
            :html="renderedHtml"
            @click="handleContentClick"
          />
        </article>
      </main>

      <DocOutline
        :items="outlineItems"
        :active-slug="activeSlug"
        @navigate="scrollToSection"
      />

    <!-- AI Chat Toggle -->
    <button
      type="button"
      class="chat-fab"
      :class="{ active: chatOpen }"
      @click="toggleChat"
      aria-label="Toggle AI Chat"
    >
      <span v-if="chatOpen">✕</span>
      <span v-else>AI Chat</span>
    </button>

    <!-- AI Chat Panel -->
    <div v-if="chatOpen" class="chat-pane">
      <DocsChatWidget
        :doc-id="docId"
        @close="chatOpen = false"
      />
    </div>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">
      {{ toastMsg }}
    </div>
  </div>

  <div
    v-if="doc && !isLoading && !feedbackGiven"
    id="docFeedback"
    class="feedback-dock-wrap"
    :class="{ 'is-expanded': showCommentForm }"
    aria-label="Page feedback"
  >
    <div class="feedback-dock">
      <template v-if="showCommentForm">
        <p class="feedback-dock-heading">What could we improve?</p>
        <textarea
          v-model="feedbackComment"
          class="feedback-textarea"
          rows="3"
          placeholder="Tell us what was missing or unclear (optional)"
          maxlength="2000"
          aria-label="Feedback comment"
        />
        <div class="feedback-dock-actions feedback-dock-actions-end">
          <button type="button" class="btn" :disabled="isSubmitting" @click="cancelCommentForm">
            Cancel
          </button>
          <button type="button" class="btn btn-accent" :disabled="isSubmitting" @click="submitNegativeFeedback">
            {{ isSubmitting ? "Sending…" : "Submit feedback" }}
          </button>
        </div>
      </template>
      <template v-else>
        <div class="feedback-dock-row">
          <div class="feedback-dock-copy">
            <p class="feedback-dock-heading">Was this page helpful?</p>
            <p class="feedback-dock-msg">Quick rating while you read</p>
          </div>
          <div class="feedback-dock-actions">
            <button type="button" class="btn btn-accent" :disabled="isSubmitting" @click="voteFeedback(true)">
              Yes
            </button>
            <button type="button" class="btn" :disabled="isSubmitting" @click="voteFeedback(false)">
              Not really
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</div>
</template>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.page-root {
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 6%, transparent);
  --font-display: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --fs-body: 14px;
  --gap-xs: 8px;
  --gap-sm: 12px;
  --gap-md: 16px;
  --gap-lg: 24px;
  --radius: 8px;
  --radius-lg: 12px;
}

.page-root button {
  font: inherit;
  cursor: pointer;
}

.page-root h1,
.page-root h2,
.page-root h3 {
  margin: 0;
  font-weight: 600;
}

.doc-sidebar-header {
  display: block;
  width: 100%;
  padding: 20px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.doc-sidebar-header:hover {
  background: color-mix(in oklch, var(--fg) 5%, var(--surface));
}

.doc-sidebar-header:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.doc-body-badges {
  margin-bottom: 8px;
}

.doc-content--dock-pad {
  --doc-footer-gap: 132px;
}

.doc-content--dock-pad-expanded {
  --doc-footer-gap: 280px;
}

@media (max-width: 640px) {
  .doc-content--dock-pad {
    --doc-footer-gap: 160px;
  }

  .doc-content--dock-pad-expanded {
    --doc-footer-gap: 300px;
  }
}

/* Chat FAB */
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 40;
  padding: 12px 20px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--surface);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px color-mix(in oklch, var(--accent) 30%, transparent);
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}
.chat-fab:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in oklch, var(--accent) 40%, transparent);
}
.chat-fab.active {
  background: var(--fg);
  color: var(--surface);
}
@media (max-width: 640px) {
  .chat-fab {
    bottom: 16px;
    right: 16px;
  }
}

/* Chat pane */
.chat-pane {
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  max-width: 100vw;
  height: 100vh;
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -4px 0 24px color-mix(in oklch, var(--fg) 10%, transparent);
}
@media (max-width: 820px) {
  .chat-pane {
    width: 100%;
  }
}

/* Feedback dock */
.feedback-dock-wrap {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width);
  right: 0;
  z-index: 35;
  display: flex;
  justify-content: center;
  padding: 0 48px 20px;
  pointer-events: none;
}
.feedback-dock-wrap.is-expanded .feedback-dock {
  padding: 16px 18px;
}
.feedback-dock {
  pointer-events: auto;
  width: 100%;
  max-width: 720px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow:
    0 8px 32px color-mix(in oklch, var(--fg) 10%, transparent),
    0 1px 0 color-mix(in oklch, var(--surface) 80%, var(--border));
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.feedback-dock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.feedback-dock-copy {
  min-width: 0;
}
.feedback-dock-heading {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
}
.feedback-dock-msg {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}
.feedback-dock-actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}
.feedback-dock-actions-end {
  justify-content: flex-end;
}
.feedback-dock .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
}
.feedback-dock .btn:hover:not(:disabled) {
  border-color: var(--fg);
}
.feedback-dock .btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.feedback-dock .btn:active:not(:disabled) {
  transform: scale(0.98);
}
.feedback-dock .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.feedback-dock .btn.btn-accent {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.feedback-dock .btn.btn-accent:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
  border-color: color-mix(in oklch, var(--accent) 88%, black);
  color: var(--surface);
}
.feedback-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  min-height: 72px;
  background: var(--bg);
  color: var(--fg);
}
.feedback-textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 0;
  border-color: var(--accent);
}

@media (max-width: 820px) {
  .feedback-dock-wrap {
    padding: 0 24px 16px;
  }
}
@media (max-width: 640px) {
  .feedback-dock-wrap {
    left: 0;
    padding: 0 16px 80px;
  }
  .feedback-dock-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .feedback-dock-actions {
    width: 100%;
  }
  .feedback-dock-actions .btn {
    flex: 1;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-dock-wrap {
    transition: none;
  }
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}

.meta-label {
  font-size: 13px;
  color: var(--muted);
}
.flex-gap-sm {
  display: flex;
  gap: 8px;
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 200;
  background: var(--fg);
  color: var(--surface);
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 20%, transparent);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.toast.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Loading & error states */
.loading-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}
.loading-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px 20px;
  overflow-y: auto;
}
.loading-content {
  flex: 1;
  padding: 40px 48px;
  display: flex;
  justify-content: center;
  overflow-y: auto;
}
.loading-outline {
  width: var(--outline-sidebar);
  flex-shrink: 0;
  padding: 28px 20px;
  border-left: 1px solid var(--border);
  background: var(--surface);
}
.sk-outline-title {
  width: 72%;
  height: 12px;
  margin-bottom: 16px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
@media (max-width: 1100px) {
  .loading-outline {
    display: none;
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Sidebar skeleton */
.sk-header {
  padding: 0 20px 16px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.sk-title {
  width: 75%;
  height: 16px;
  margin-bottom: 6px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-meta {
  width: 55%;
  height: 12px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-nav {
  padding: 0 16px 0 20px;
}
.sk-nav-item {
  height: 12px;
  margin-bottom: 12px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-nav-item.indent {
  margin-left: 12px;
  width: 80%;
}

/* Content skeleton */
.sk-body {
  width: 100%;
  max-width: 720px;
}
.sk-badge-row {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  align-items: center;
}
.sk-badge {
  width: 52px;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.sk-meta-text {
  width: 140px;
  height: 14px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-heading {
  width: 45%;
  height: 28px;
  margin: 32px 0 16px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-paragraph {
  width: 100%;
  height: 14px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-code-block {
  width: 100%;
  height: 120px;
  margin: 16px 0;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}

.error-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg);
  padding: 40px;
}
.error-body {
  text-align: center;
  max-width: 480px;
}
.error-body h1 {
  font-size: 22px;
  margin-bottom: 12px;
  color: var(--fg);
  font-weight: 600;
}
.error-body p {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html {
    scroll-behavior: auto;
  }
  .sk-title,
  .sk-meta,
  .sk-nav-item,
  .sk-badge,
  .sk-meta-text,
  .sk-heading,
  .sk-paragraph,
  .sk-code-block {
    animation: none;
    background: var(--border);
  }
}
</style>
