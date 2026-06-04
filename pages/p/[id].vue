<script setup lang="ts">
import { nextTick } from "vue";
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";
import type { PublishedDocDetail } from "~/composables/usePublishedDocs";

definePageMeta({
  layout: "public",
  auth: false,
});

const route = useRoute();
const { fetchPublishedDoc } = usePublishedDocs();

const docId = computed(() => route.params.id as string);
const doc = ref<PublishedDocDetail | null>(null);
const isLoading = ref(true);
const error = ref("");
const feedbackGiven = ref(false);

const toastMsg = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const chatOpen = ref(false);

const activeSlug = ref("");
let scrollSpyPaused = false;
let scrollSpyPauseTimer: ReturnType<typeof setTimeout> | null = null;

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

/* ── Nav items from content headings ─────────────────────────── */
interface NavItem {
  type: "section" | "indent";
  text: string;
  slug: string;
}

const navItems = computed<NavItem[]>(() => {
  if (!doc.value?.content) return [];
  const headings = extractHeadings(doc.value.content);
  return headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => {
      const slug = h.text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return {
        type: h.level === 2 ? ("section" as const) : ("indent" as const),
        text: h.text,
        slug,
      };
    });
});

onMounted(async () => {
  if (!docId.value) {
    error.value = "No document ID provided";
    isLoading.value = false;
    return;
  }
  try {
    const data = await fetchPublishedDoc(docId.value);
    doc.value = data;
    nextTick(() => {
      setupScrollSpy();
      if (route.hash) {
        const target = document.getElementById(route.hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          activeSlug.value = route.hash.slice(1);
        }
      }
    });
  } catch (e: any) {
    error.value = e?.data?.message || "Documentation not found";
  } finally {
    isLoading.value = false;
  }
});

function scrollToSection(targetId: string) {
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    activeSlug.value = targetId;

    scrollSpyPaused = true;
    if (scrollSpyPauseTimer) clearTimeout(scrollSpyPauseTimer);
    scrollSpyPauseTimer = setTimeout(() => {
      scrollSpyPaused = false;
    }, 800);
  }
}

function setupScrollSpy() {
  const contentEl = document.querySelector(".public-main") as HTMLElement | null;
  const docContent = document.getElementById("docContent");
  if (!docContent || !contentEl) return;

  const headings = Array.from(docContent.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
  if (headings.length === 0) return;

  function updateActiveNav() {
    if (scrollSpyPaused) return;

    const contentRect = contentEl!.getBoundingClientRect();
    const threshold = contentRect.top + 160;

    let currentId = "";
    for (const h of headings) {
      const hRect = h.getBoundingClientRect();
      if (hRect.top < threshold) {
        currentId = h.id;
      }
    }

    if (!currentId && headings.length > 0) {
      currentId = headings[0].id;
    }

    activeSlug.value = currentId;
  }

  contentEl.addEventListener("scroll", updateActiveNav, { passive: true });
  updateActiveNav();
}

function copyCode(btn: HTMLButtonElement) {
  const pre = btn.previousElementSibling as HTMLPreElement | null;
  if (!pre) return;
  const code = pre.querySelector("code") || pre;
  navigator.clipboard
    .writeText(code.textContent || "")
    .then(() => {
      btn.textContent = "Copied";
      btn.classList.add("copied");
      showToast("Code copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    })
    .catch(() => showToast("Copy failed"));
}

function voteFeedback(btn: HTMLButtonElement, positive: boolean) {
  if (feedbackGiven.value) return;
  feedbackGiven.value = true;
  const bar = document.getElementById("feedbackBar");
  if (!bar) return;
  const buttons = bar.querySelectorAll<HTMLButtonElement>(".btn");
  buttons.forEach((b) => b.classList.remove("voted"));
  btn.classList.add("voted");
  showToast(positive ? "Thanks for the feedback!" : "We will improve this section");
}

function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest(".copy-btn") as HTMLButtonElement | null;
  if (copyBtn) {
    e.preventDefault();
    copyCode(copyBtn);
  }
}

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

function scrollToTop() {
  const el = document.getElementById("docContent");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function itemHref(item: NavItem): string {
  return "#" + item.slug;
}

function itemTarget(item: NavItem): string {
  return item.slug;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
</script>

<template>
  <div v-if="isLoading" class="loading-state">
    <div class="sk-header">
      <div class="sk-title" />
      <div class="sk-meta" />
    </div>
    <div class="sk-body">
      <div v-for="n in 6" :key="n" class="sk-paragraph" :style="{ width: `${60 + Math.random() * 40}%` }" />
    </div>
  </div>

  <div v-else-if="error" class="error-state">
    <h1>{{ error }}</h1>
    <p>The documentation you are looking for could not be loaded.</p>
  </div>

  <div v-else-if="doc" class="doc-view">
    <!-- Header -->
    <header class="doc-header">
      <div class="breadcrumbs">
        <span v-if="doc.app">{{ doc.app.name }}</span>
        <span v-if="doc.version">{{ doc.version.version }}</span>
      </div>
      <h1 class="doc-title">{{ doc.title }}</h1>
      <div class="doc-meta">
        <span v-if="doc.author" class="author">{{ doc.author }}</span>
        <span v-if="doc.updatedAt" class="date">Updated {{ formatDate(doc.updatedAt) }}</span>
      </div>
      <div v-if="doc.tags && doc.tags.length > 0" class="tags">
        <span v-for="tag in doc.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </header>

    <!-- TOC -->
    <nav v-if="navItems.length > 0" class="toc">
      <div class="toc-title">On this page</div>
      <ul>
        <li v-for="(item, idx) in navItems" :key="idx">
          <a
            :class="[item.type, { active: activeSlug === item.slug }]"
            :href="itemHref(item)"
            @click.prevent="scrollToSection(item.slug)"
          >
            {{ item.text }}
          </a>
        </li>
      </ul>
    </nav>

    <!-- Content -->
    <article id="docContent" class="doc-body">
      <div class="markdown-content" v-html="renderedHtml" @click="handleContentClick" />

      <!-- Feedback -->
      <div class="feedback-bar" id="feedbackBar">
        <span class="feedback-msg">Was this helpful?</span>
        <button type="button" class="btn" @click="voteFeedback($event.currentTarget as HTMLButtonElement, true)">
          Yes
        </button>
        <button type="button" class="btn" @click="voteFeedback($event.currentTarget as HTMLButtonElement, false)">
          No
        </button>
      </div>
    </article>

    <!-- AI Chat Toggle -->
    <button
      type="button"
      class="chat-fab"
      :class="{ active: chatOpen }"
      @click="toggleChat"
      aria-label="Toggle AI Chat"
    >
      <span v-if="chatOpen">✕</span>
      <span v-else">AI Chat</span>
    </button>

    <!-- AI Chat Panel -->
    <div v-if="chatOpen" class="chat-pane">
      <DocsChatWidget
        :doc-id="docId"
        :doc-content="doc?.content || ''"
        :doc-title="doc?.title || ''"
        @close="chatOpen = false"
      />
    </div>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">
      {{ toastMsg }}
    </div>
  </div>
</template>

<style scoped>
.doc-view {
  position: relative;
}

/* Header */
.doc-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.breadcrumbs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--muted);
}
.breadcrumbs span:not(:last-child)::after {
  content: "/";
  margin-left: 8px;
  color: var(--border);
}
.doc-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--fg);
}
.doc-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: var(--accent-soft);
  color: var(--accent);
}

/* TOC */
.toc {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.toc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.toc ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toc a {
  display: block;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  cursor: pointer;
}
.toc a:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 7%, transparent);
}
.toc a.section {
  font-weight: 600;
  color: var(--fg);
}
.toc a.indent {
  padding-left: 20px;
  font-size: 12.5px;
}
.toc a.active {
  color: var(--accent);
  background: var(--accent-soft);
}

/* Doc body */
.doc-body :deep(h1) {
  font-size: 28px;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.doc-body :deep(h2) {
  font-size: 22px;
  margin: 40px 0 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  line-height: 1.3;
}
.doc-body :deep(h3) {
  font-size: 17px;
  margin: 24px 0 12px;
  line-height: 1.4;
}
.doc-body :deep(p) {
  margin: 0 0 16px;
  line-height: 1.7;
}
.doc-body :deep(ul) {
  padding-left: 28px;
  margin: 0 0 16px;
  list-style-type: disc;
}
.doc-body :deep(ol) {
  padding-left: 28px;
  margin: 0 0 16px;
  list-style-type: decimal;
}
.doc-body :deep(li) {
  margin: 6px 0;
}
.doc-body :deep(li:last-child) {
  margin-bottom: 0;
}
.doc-body :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--fg);
}
.doc-body :deep(pre) {
  position: relative;
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow: auto;
  border: 1px solid var(--border);
  margin: 0 0 16px;
}
.doc-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
}
.doc-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 0 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.doc-body :deep(th),
.doc-body :deep(td) {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.doc-body :deep(th) {
  font-weight: 600;
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: var(--bg);
}
.doc-body :deep(tr:last-child td) {
  border-bottom: none;
}
.doc-body :deep(blockquote) {
  margin: 0 0 16px;
  padding: 16px 20px;
  background: var(--accent-soft);
  border-radius: var(--radius);
  border: 1px solid color-mix(in oklch, var(--accent) 20%, transparent);
}
.doc-body :deep(blockquote p) {
  margin: 0;
}
.doc-body :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 32px 0;
}
.doc-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.doc-body :deep(strong) {
  font-weight: 600;
  color: var(--fg);
}
.doc-body :deep(em) {
  font-style: italic;
}
.doc-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
  margin: 8px 0 16px;
  box-shadow: 0 1px 3px color-mix(in oklch, var(--fg) 8%, transparent);
}

/* Code copy button */
.doc-body :deep(.code-block) {
  position: relative;
  margin: 0 0 16px;
}
.doc-body :deep(pre) {
  position: relative;
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow: auto;
  border: 1px solid var(--border);
  margin: 0;
}
.doc-body :deep(.copy-btn) {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 5px 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s, color 0.2s;
}
.doc-body :deep(.code-block:hover .copy-btn),
.doc-body :deep(pre:hover .copy-btn) {
  opacity: 1;
}
.doc-body :deep(.copy-btn:hover) {
  background: var(--fg-soft);
  color: var(--fg);
}
.doc-body :deep(.copy-btn:focus-visible) {
  opacity: 1;
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.doc-body :deep(.copy-btn.copied) {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}

/* Feedback */
.feedback-bar {
  display: flex;
  gap: 12px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  align-items: center;
}
.feedback-bar .feedback-msg {
  font-size: 13px;
  color: var(--muted);
}
.feedback-bar .btn {
  padding: 4px 12px;
  font-size: 13px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
}
.feedback-bar .btn:hover {
  border-color: var(--fg);
  color: var(--fg);
}
.feedback-bar .btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.feedback-bar .btn:active {
  transform: scale(0.96);
}
.feedback-bar .btn.voted {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
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
@media (max-width: 640px) {
  .chat-pane {
    width: 100%;
  }
  .chat-fab {
    bottom: 16px;
    right: 16px;
  }
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
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}
.toast.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Loading state */
.loading-state {
  padding: 40px 0;
}
.sk-header {
  margin-bottom: 24px;
}
.sk-title {
  width: 60%;
  height: 32px;
  margin-bottom: 12px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-meta {
  width: 40%;
  height: 16px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
.sk-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-paragraph {
  height: 16px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error state */
.error-state {
  text-align: center;
  padding: 48px 0;
}
.error-state h1 {
  font-size: 22px;
  margin-bottom: 12px;
  color: var(--fg);
}
.error-state p {
  color: var(--muted);
  font-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .sk-title,
  .sk-meta,
  .sk-paragraph {
    animation: none;
    background: var(--border);
  }
}
</style>
