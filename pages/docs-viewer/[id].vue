<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const docId = computed(() => route.params.id as string);

const { currentDoc, isLoading, fetchPublishedDoc } = usePublishedDocs();

const activeHeading = ref("");
const docLoading = ref(false);
const docNotFound = ref(false);
const previewBodyRef = ref<HTMLDivElement | null>(null);

const headings = computed(() => {
  if (!currentDoc.value?.content) return [];
  return extractHeadings(currentDoc.value.content);
});

const renderedHtml = computed(() => {
  if (!currentDoc.value?.content) return "";
  return renderMarkdown(currentDoc.value.content);
});

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function injectHeadingIds() {
  nextTick(() => {
    const container = previewBodyRef.value;
    if (!container) return;
    const headingElements = container.querySelectorAll("h1, h2, h3");
    headingElements.forEach((el) => {
      const text = el.textContent || "";
      if (!el.id) {
        el.id = `heading-${slugify(text)}`;
      }
    });
  });
}

function scrollToHeading(text: string) {
  activeHeading.value = text;
  const el = document.getElementById(`heading-${slugify(text)}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

watch(renderedHtml, () => {
  injectHeadingIds();
});

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

async function loadDoc() {
  if (!docId.value) return;
  docLoading.value = true;
  docNotFound.value = false;
  try {
    await fetchPublishedDoc(docId.value);
    if (!currentDoc.value) {
      docNotFound.value = true;
    }
  } catch {
    docNotFound.value = true;
  } finally {
    docLoading.value = false;
  }
}

onMounted(() => {
  $page.setTitle("Published Docs");
  loadDoc();
});

watch(() => docId.value, () => {
  loadDoc();
});

const appName = computed(() => currentDoc.value?.app?.name || "Unbound");
</script>

<template>
  <div class="viewer-page">
    <header class="topbar">
      <div class="flex-gap-md">
        <button
          type="button"
          class="btn btn-ghost back-btn"
          title="Back to published docs"
          @click="router.push('/docs-viewer')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>{{ currentDoc?.title || "Published Doc" }}</h1>
        <span class="pill pill-blue">{{ appName }}</span>
      </div>
      <div class="flex-gap-sm">
        <NuxtLink :to="`/docs-editor/${docId}`" class="btn btn-secondary">
          Edit
        </NuxtLink>
      </div>
    </header>

    <main class="content-area">
      <!-- Loading state -->
      <div v-if="docLoading" class="viewer-loading">
        <div class="skeleton-pane" style="width: 220px; height: 100%;">
          <div class="skeleton-title" />
          <div v-for="n in 8" :key="n" class="skeleton-line" />
        </div>
        <div class="skeleton-pane" style="flex: 1; height: 100%;">
          <div v-for="n in 24" :key="n" class="skeleton-line" />
        </div>
        <div class="skeleton-pane" style="width: 280px; height: 100%;">
          <div class="skeleton-title" />
          <div v-for="n in 6" :key="n" class="skeleton-field" />
        </div>
      </div>

      <!-- Not found state -->
      <div v-else-if="docNotFound" class="not-found">
        <h2>Doc not found</h2>
        <p>The published document you are looking for does not exist or is not publicly available.</p>
        <button type="button" class="btn btn-primary" @click="router.push('/docs-viewer')">
          Back to Published Docs
        </button>
      </div>

      <div v-else class="doc-shell">
        <!-- Outline -->
        <div class="outline-pane">
          <div class="outline-title">Document Outline</div>
          <ul class="outline-tree" role="list">
            <li
              v-for="(h, idx) in headings"
              :key="idx"
              :class="{ indent: h.level > 1, active: activeHeading === h.text }"
              role="listitem"
              tabindex="0"
              @click="scrollToHeading(h.text)"
              @keydown.enter="scrollToHeading(h.text)"
              @keydown.space.prevent="scrollToHeading(h.text)"
            >
              {{ h.text }}
            </li>
            <li v-if="headings.length === 0" class="indent" style="opacity:0.6;">
              No headings
            </li>
          </ul>
        </div>

        <!-- Content -->
        <div class="content-pane">
          <div ref="previewBodyRef" class="preview-body" v-html="renderedHtml" />
        </div>

        <!-- Metadata -->
        <div class="meta-pane">
          <div class="meta-title">Document Info</div>
          <div class="field">
            <label>Title</label>
            <div class="value">{{ currentDoc?.title }}</div>
          </div>
          <div class="field">
            <label>App</label>
            <div class="value">{{ currentDoc?.app?.name || "Unbound" }}</div>
          </div>
          <div class="field">
            <label>Version</label>
            <div class="value">{{ currentDoc?.version?.version || "Unbound" }}</div>
          </div>
          <div class="field">
            <label>Author</label>
            <div class="value">{{ currentDoc?.author || "Unknown" }}</div>
          </div>
          <div class="field">
            <label>Published</label>
            <div class="value">{{ formatDateTime(currentDoc?.updatedAt) }}</div>
          </div>
          <div v-if="currentDoc?.tags && currentDoc.tags.length > 0" class="field">
            <label>Tags</label>
            <div class="tag-list">
              <span v-for="tag in currentDoc.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.viewer-page {
  --bg: oklch(98% 0.004 250);
  --surface: oklch(100% 0 0);
  --fg: oklch(20% 0.02 250);
  --muted: oklch(55% 0.015 250);
  --border: oklch(90% 0.006 250);
  --accent: oklch(55% 0.16 25);
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 6%, transparent);
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --radius: 8px;
  --radius-lg: 12px;
}

.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  margin: -32px -32px 0;
}
.topbar h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}

.back-btn {
  padding: 6px;
}

.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}
.flex-gap-sm {
  display: flex;
  gap: 8px;
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

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
  text-decoration: none;
}
.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--fg);
}
.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--fg);
}

.content-area {
  padding: 24px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.doc-shell {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
@media (max-width: 1100px) {
  .doc-shell {
    grid-template-columns: 1fr;
  }
  .doc-shell .outline-pane,
  .doc-shell .meta-pane {
    display: none;
  }
}

.outline-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  overflow: auto;
}
.outline-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 12px;
  font-weight: 500;
}
.outline-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}
.outline-tree li {
  padding: 6px 8px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.outline-tree li:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}
.outline-tree li:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.outline-tree li.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.outline-tree .indent {
  padding-left: 20px;
}

.content-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  overflow: auto;
  min-height: 0;
}

.preview-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  max-width: 720px;
}
.preview-body :deep(h1) {
  font-size: 28px;
  margin-bottom: 20px;
  font-weight: 600;
}
.preview-body :deep(h2) {
  font-size: 22px;
  margin: 32px 0 16px;
  font-weight: 600;
}
.preview-body :deep(h3) {
  font-size: 18px;
  margin: 24px 0 12px;
  font-weight: 600;
}
.preview-body :deep(ul),
.preview-body :deep(ol) {
  padding-left: 24px;
}
.preview-body :deep(li) {
  margin: 6px 0;
}
.preview-body :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}
.preview-body :deep(pre) {
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow: auto;
  margin: 16px 0;
}
.preview-body :deep(pre code) {
  background: none;
  padding: 0;
}
.preview-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}
.preview-body :deep(th),
.preview-body :deep(td) {
  padding: 10px 14px;
  border: 1px solid var(--border);
  text-align: left;
}
.preview-body :deep(th) {
  background: var(--bg);
  font-weight: 600;
}
.preview-body :deep(blockquote) {
  border-left: 3px solid var(--border);
  margin: 16px 0;
  padding-left: 20px;
  color: var(--muted);
}
.preview-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 32px 0;
}
.preview-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius);
  margin: 8px 0;
}
.preview-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.preview-body :deep(input[type="checkbox"]) {
  margin-right: 6px;
}

.meta-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  overflow: auto;
}
.meta-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 16px;
  font-weight: 500;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}
.field label {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.field .value {
  font-size: 13px;
  color: var(--fg);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.viewer-loading {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
.skeleton-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton-title {
  height: 14px;
  width: 60%;
  background: var(--border);
  border-radius: 4px;
  margin-bottom: 6px;
}
.skeleton-line {
  height: 12px;
  width: 100%;
  background: var(--border);
  border-radius: 4px;
  opacity: 0.7;
}
.skeleton-line:nth-child(3n) { width: 75%; }
.skeleton-line:nth-child(3n + 1) { width: 90%; }
.skeleton-field {
  height: 32px;
  width: 100%;
  background: var(--border);
  border-radius: var(--radius);
  opacity: 0.6;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  text-align: center;
  color: var(--muted);
}
.not-found h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}
.not-found p {
  margin: 0;
  font-size: 14px;
  max-width: 400px;
}

@media (prefers-reduced-motion: reduce) {
  .outline-tree li,
  .btn,
  .card {
    transition: none !important;
  }
}
</style>
