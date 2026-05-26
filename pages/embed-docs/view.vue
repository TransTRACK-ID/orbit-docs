<script setup lang="ts">
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";
import type { PublishedDocDetail } from "~/composables/usePublishedDocs";

definePageMeta({
  layout: false,
  auth: false,
});

const route = useRoute();
const { fetchPublishedDoc } = usePublishedDocs();

const docId = computed(() => (route.query.id as string) || "");
const doc = ref<PublishedDocDetail | null>(null);
const isLoading = ref(true);
const error = ref("");
const feedbackGiven = ref(false);

const toastMsg = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

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
      bindNavClick();
      setupScrollSpy();
      if (route.hash) {
        const target = document.getElementById(route.hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  } catch (e: any) {
    error.value = e?.data?.message || "Documentation not found";
  } finally {
    isLoading.value = false;
  }
});

function bindNavClick() {
  const navEl = document.getElementById("docNav");
  if (!navEl) return;
  const links = navEl.querySelectorAll<HTMLAnchorElement>("a[data-target]");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      if (!targetId) return;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        links.forEach((a) => a.classList.remove("active"));
        link.classList.add("active");
      }
    });
  });
}

function setupScrollSpy() {
  const content = document.getElementById("docContent");
  if (!content) return;
  const headings = content.querySelectorAll<HTMLElement>("h2[id], h3[id]");
  if (headings.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const navEl = document.getElementById("docNav");
          if (!navEl) return;
          const links = navEl.querySelectorAll<HTMLAnchorElement>("a[data-target]");
          links.forEach((a) => {
            a.classList.toggle("active", a.dataset.target === id);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  headings.forEach((h) => observer.observe(h));
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

function itemHref(item: NavItem): string {
  return "#" + item.slug;
}

function itemTarget(item: NavItem): string {
  return item.slug;
}
</script>

<template>
  <div v-if="isLoading" class="loading-shell">
    <div class="loading-sidebar">
      <div class="sk-header">
        <div class="sk-title" />
        <div class="sk-meta" />
      </div>
      <div class="sk-nav">
        <div v-for="n in 6" :key="n" class="sk-nav-item" :class="{ indent: n % 3 === 0 }" :style="{ width: `${65 + Math.random() * 25}%` }" />
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
  </div>

  <div v-else-if="error" class="error-shell">
    <div class="error-body">
      <h1>{{ error }}</h1>
      <p>The documentation you are looking for could not be loaded.</p>
    </div>
  </div>

  <div v-else-if="doc" class="embed-shell">
    <aside class="doc-sidebar" data-od-id="doc-sidebar">
      <div class="doc-sidebar-header">
        <div class="doc-sidebar-title">{{ doc.app?.name || doc.title }}</div>
        <div class="doc-sidebar-meta num">
          {{ doc.version?.version ? `v${doc.version.version}` : "" }}
          <span v-if="doc.updatedAt">· Updated {{ new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}</span>
        </div>
      </div>
      <ul v-if="navItems.length > 0" id="docNav" class="doc-nav" role="list">
        <li v-for="(item, idx) in navItems" :key="idx">
          <a
            :class="[item.type, idx === 0 ? 'active' : '']"
            role="listitem"
            :href="itemHref(item)"
            :data-target="itemTarget(item)"
            :tabindex="item.type === 'indent' ? 0 : undefined"
          >
            {{ item.text }}
          </a>
        </li>
      </ul>
      <ul v-else id="docNav" class="doc-nav" role="list">
        <li><a class="section active" role="listitem" href="#docContent" data-target="docContent">Documentation</a></li>
      </ul>
    </aside>

    <main class="content" data-od-id="content">
      <article id="docContent" class="doc-body">
        <div class="flex-gap-sm" style="margin-bottom: 8px;">
          <span class="pill pill-green">Latest</span>
          <span v-if="doc.updatedAt" class="meta-label num">
            Updated {{ new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
          </span>
        </div>

        <div class="markdown-content" v-html="renderedHtml" @click="handleContentClick" />

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
    </main>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">
      {{ toastMsg }}
    </div>
  </div>
</template>

<style scoped>
:root {
  --bg: oklch(98% 0.004 250);
  --surface: oklch(100% 0 0);
  --fg: oklch(20% 0.02 250);
  --muted: oklch(55% 0.015 250);
  --border: oklch(90% 0.006 250);
  --accent: oklch(55% 0.16 25);
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
  --sidebar: 220px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
  cursor: pointer;
}

h1,
h2,
h3 {
  margin: 0;
  font-weight: 600;
}

.embed-shell {
  display: flex;
  min-height: 100vh;
}

/* Doc nav sidebar */
.doc-sidebar {
  width: var(--sidebar);
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px 0;
  overflow-y: auto;
}
.doc-sidebar-header {
  padding: 0 20px 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.doc-sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 4px;
  line-height: 1.3;
}
.doc-sidebar-meta {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}
.doc-nav {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}
.doc-nav li {
  margin: 0;
}
.doc-nav a {
  display: block;
  padding: 5px 20px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  position: relative;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 6px 6px 0;
  margin-right: 12px;
}
.doc-nav a::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  border-radius: 0 2px 2px 0;
  background: transparent;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.doc-nav a:focus-visible {
  outline: none;
  background: var(--fg-soft);
}
.doc-nav a:hover {
  color: var(--fg);
  background: var(--fg-soft);
}
.doc-nav a.section {
  font-weight: 600;
  color: var(--fg);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 16px;
  padding-top: 8px;
  padding-bottom: 6px;
}
.doc-nav a.section:first-child {
  margin-top: 4px;
  padding-top: 6px;
}
.doc-nav a.active {
  color: var(--accent);
  font-weight: 500;
  background: var(--accent-soft);
}
.doc-nav a.active::before {
  background: var(--accent);
}
.doc-nav a.indent {
  padding-left: 32px;
  font-size: 12.5px;
}

/* Content */
.content {
  flex: 1;
  min-width: 0;
  padding: 40px 48px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}
.doc-body {
  width: 100%;
  max-width: 720px;
}
@media (max-width: 720px) {
  .doc-sidebar {
    width: 180px;
  }
  .content {
    padding: 24px;
  }
}

.doc-body :deep(h1) {
  font-size: 32px;
  margin-bottom: 24px;
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

/* Markdown content wrapper */
.markdown-content {
  width: 100%;
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
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
  margin-top: 32px;
  padding-top: 20px;
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
  min-height: 100vh;
  background: var(--bg);
}
.loading-sidebar {
  width: var(--sidebar);
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px 16px;
}
.loading-content {
  flex: 1;
  padding: 40px 48px;
  display: flex;
  justify-content: center;
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
