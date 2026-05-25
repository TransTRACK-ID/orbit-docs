<script setup lang="ts">
import type { EmbedDocItem, EmbedNavItem } from "~/composables/useEmbedDocs";

definePageMeta({
  layout: false,
  auth: false,
});

const route = useRoute();
const { fetchPublicEmbedDoc } = useEmbedDocs();

const slug = computed(() => (route.query.slug as string) || "");
const doc = ref<EmbedDocItem | null>(null);
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

onMounted(async () => {
  if (!slug.value) {
    error.value = "No slug provided";
    isLoading.value = false;
    return;
  }
  try {
    const data = await fetchPublicEmbedDoc(slug.value);
    doc.value = data;
    // Set active nav based on URL hash if present
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
  const headings = content.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]");
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

function itemHref(item: EmbedNavItem): string {
  const text = item.text || "";
  return (
    "#" +
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

function itemTarget(item: EmbedNavItem): string {
  return itemHref(item).slice(1);
}
</script>

<template>
  <div v-if="isLoading" class="loading-shell">
    <div class="loading-sidebar">
      <div class="loading-block" style="width: 70%; height: 16px; margin-bottom: 24px;" />
      <div v-for="n in 8" :key="n" class="loading-block" :style="{ width: `${60 + Math.random() * 30}%`, height: '12px', marginBottom: '14px', marginLeft: n % 3 === 0 ? '0' : '12px' }" />
    </div>
    <div class="loading-content">
      <div class="loading-block" style="width: 50%; height: 32px; margin-bottom: 24px;" />
      <div class="loading-block" style="width: 100%; height: 120px; margin-bottom: 16px;" />
      <div class="loading-block" style="width: 100%; height: 200px; margin-bottom: 16px;" />
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
      <ul v-if="doc.navItems && doc.navItems.length > 0" id="docNav" class="doc-nav" role="list">
        <li v-for="(item, idx) in doc.navItems" :key="idx">
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
          <span class="pill" :class="doc.status === 'published' ? 'pill-green' : 'pill-blue'">
            {{ doc.status === 'published' ? 'Latest' : doc.status }}
          </span>
          <span v-if="doc.updatedAt" class="meta-label num">
            Updated {{ new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
          </span>
        </div>

        <div v-html="doc.content" @click="handleContentClick" />

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
  padding: 20px 0;
  overflow-y: auto;
}
.doc-sidebar-header {
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.doc-sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 4px;
}
.doc-sidebar-meta {
  font-size: 12px;
  color: var(--muted);
}
.doc-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}
.doc-nav a {
  display: block;
  padding: 6px 16px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.doc-nav a:focus-visible {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.doc-nav a:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.doc-nav a.section {
  font-weight: 600;
  color: var(--fg);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.doc-nav a.section:first-child {
  margin-top: 0;
  border-top: none;
  padding-top: 0;
}
.doc-nav a.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.doc-nav a.indent {
  padding-left: 28px;
  font-size: 13px;
}

/* Content */
.content {
  flex: 1;
  min-width: 0;
  padding: 32px 40px;
  overflow-y: auto;
}
@media (max-width: 720px) {
  .doc-sidebar {
    width: 180px;
  }
  .content {
    padding: 20px;
  }
}

.doc-body :deep(h1) {
  font-size: 28px;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}
.doc-body :deep(h2) {
  font-size: 20px;
  margin: 32px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.doc-body :deep(h3) {
  font-size: 15px;
  margin: 20px 0 10px;
}
.doc-body :deep(p) {
  margin: 0 0 14px;
  line-height: 1.7;
}
.doc-body :deep(ul),
.doc-body :deep(ol) {
  padding-left: 24px;
  margin: 0 0 14px;
}
.doc-body :deep(li) {
  margin: 5px 0;
}
.doc-body :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
}
.doc-body :deep(pre) {
  position: relative;
  background: var(--bg);
  padding: 14px;
  border-radius: var(--radius);
  overflow: auto;
  border: 1px solid var(--border);
  margin: 0 0 14px;
}
.doc-body :deep(pre code) {
  background: none;
  padding: 0;
}
.doc-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 0 0 14px;
}
.doc-body :deep(th),
.doc-body :deep(td) {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.doc-body :deep(th) {
  font-weight: 600;
  font-size: 12px;
  color: var(--muted);
}
.doc-body :deep(blockquote) {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 var(--radius) var(--radius) 0;
}
.doc-body :deep(blockquote p) {
  margin: 0;
}
.doc-body :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 28px 0;
}
.doc-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Code copy button */
.doc-body :deep(.code-block) {
  position: relative;
}
.doc-body :deep(.copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.doc-body :deep(.code-block:hover .copy-btn) {
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
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
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
  padding: 20px 16px;
}
.loading-content {
  flex: 1;
  padding: 32px 40px;
}
.loading-block {
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--fg);
}
.error-body p {
  color: var(--muted);
  font-size: 14px;
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
  .loading-block {
    animation: none;
    background: var(--border);
  }
}
</style>
