<script setup lang="ts">
import { nextTick } from "vue";
import type {
  CollectionDocsResponse,
  ApiDocBlock,
  ApiDocEndpoint,
} from "~/types/apiDocs";

definePageMeta({
  layout: false,
  auth: false,
});

const route = useRoute();
const { fetchApiDocs, data, isLoading, error } = useApiDocs();

const slug = computed(() => (route.params.slug as string) || "");

const doc = ref<CollectionDocsResponse | null>(null);
const pageLoading = ref(true);
const pageError = ref("");

const activeSectionId = ref("");
let sectionObserver: IntersectionObserver | null = null;

/* ── Fetch data ──────────────────────────────────────────────── */
async function load() {
  if (!slug.value) {
    pageError.value = "No documentation slug provided";
    pageLoading.value = false;
    return;
  }
  try {
    const result = await fetchApiDocs(slug.value);
    doc.value = result;
  } catch (e: any) {
    pageError.value = error.value || "Documentation not found";
  } finally {
    pageLoading.value = false;
  }
}

onMounted(() => {
  load();
});

watch(() => slug.value, () => {
  load();
});

/* ── Computed helpers for doc blocks ─────────────────────────── */
const collectionLevelBlocks = computed<ApiDocBlock[]>(() => {
  if (!doc.value?.docBlocks) return [];
  return doc.value.docBlocks
    .filter((b) => !b.folderId && !b.requestId)
    .sort((a, b) => a.order - b.order);
});

function folderBlocks(folderId: string): ApiDocBlock[] {
  if (!doc.value?.docBlocks) return [];
  return doc.value.docBlocks
    .filter((b) => b.folderId === folderId && !b.requestId)
    .sort((a, b) => a.order - b.order);
}

function requestBlocksBefore(requestId: string): ApiDocBlock[] {
  if (!doc.value?.docBlocks) return [];
  return doc.value.docBlocks
    .filter((b) => b.requestId === requestId && b.order < 0)
    .sort((a, b) => a.order - b.order);
}

function requestBlocksAfter(requestId: string): ApiDocBlock[] {
  if (!doc.value?.docBlocks) return [];
  return doc.value.docBlocks
    .filter((b) => b.requestId === requestId && b.order >= 0)
    .sort((a, b) => a.order - b.order);
}

/* ── Identify root endpoints ───────────────────────────────── */
const rootEndpoints = computed<ApiDocEndpoint[]>(() => {
  if (!doc.value?.endpoints || !doc.value?.folders) return [];
  const folderEndpointIds = new Set<string>();
  const collectIds = (folders: any[]) => {
    for (const f of folders) {
      f.requests?.forEach((r: any) => folderEndpointIds.add(r.id));
      collectIds(f.children || []);
    }
  };
  collectIds(doc.value.folders);
  return doc.value.endpoints.filter((ep) => !folderEndpointIds.has(ep.id));
});

/* ── Outline / Scroll Spy ──────────────────────────────────── */
interface OutlineItem {
  id: string;
  label: string;
  type: "collection" | "folder" | "endpoint";
  method?: string;
  depth: number;
}

const outline = computed<OutlineItem[]>(() => {
  if (!doc.value) return [];
  const items: OutlineItem[] = [];

  items.push({
    id: "guide-section-collection",
    label: doc.value.collection.name,
    type: "collection",
    depth: 0,
  });

  for (const ep of rootEndpoints.value) {
    items.push({
      id: `guide-section-endpoint-${ep.id}`,
      label: ep.name,
      type: "endpoint",
      method: ep.method,
      depth: 1,
    });
  }

  for (const folder of doc.value.folders || []) {
    items.push({
      id: `guide-section-folder-${folder.id}`,
      label: folder.name,
      type: "folder",
      depth: 1,
    });
    for (const req of folder.requests || []) {
      items.push({
        id: `guide-section-endpoint-${req.id}`,
        label: req.name,
        type: "endpoint",
        method: req.method,
        depth: 2,
      });
    }
  }

  return items;
});

const guideContentRef = ref<HTMLElement | null>(null);

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  const container = guideContentRef.value;
  if (!el || !container) return;
  const top = el.offsetTop - container.offsetTop - 16;
  container.scrollTo({ top, behavior: "smooth" });
  activeSectionId.value = id;
}

function setupScrollSpy() {
  const container = guideContentRef.value;
  if (!container) return;

  const targets = container.querySelectorAll<HTMLElement>('[id^="guide-section-"]');
  if (!targets.length) return;

  sectionObserver?.disconnect();
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0 && visible[0]) {
        activeSectionId.value = visible[0].target.id;
      }
    },
    {
      root: container,
      rootMargin: "-10% 0px -60% 0px",
      threshold: 0,
    }
  );

  targets.forEach((t) => sectionObserver!.observe(t));
}

watch(
  () => doc.value,
  () => {
    if (doc.value) {
      nextTick(() => {
        setupScrollSpy();
      });
    }
  }
);

onBeforeUnmount(() => {
  sectionObserver?.disconnect();
  sectionObserver = null;
});

/* ── Meta ──────────────────────────────────────────────────── */
useHead({
  title: computed(() =>
    doc.value?.collection.name
      ? `${doc.value.collection.name} · API Docs`
      : "API Documentation"
  ),
  meta: [
    {
      name: "description",
      content: computed(() =>
        doc.value?.collection.description
          ? `View API documentation for ${doc.value.collection.name}`
          : "API documentation"
      ),
    },
  ],
});

/* ── Helpers ───────────────────────────────────────────────── */
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: "oklch(55% 0.16 255)",
    POST: "oklch(55% 0.16 145)",
    PUT: "oklch(60% 0.16 85)",
    PATCH: "oklch(55% 0.16 300)",
    DELETE: "oklch(55% 0.16 25)",
    HEAD: "oklch(55% 0.02 250)",
    OPTIONS: "oklch(55% 0.1 190)",
  };
  return colors[method] || "oklch(55% 0.02 250)";
}
</script>

<template>
  <div class="api-docs-page">
    <!-- Loading -->
    <div v-if="pageLoading || isLoading" class="loading-shell">
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

  <!-- Error -->
  <div v-else-if="pageError || error" class="error-shell">
    <div class="error-body">
      <h1>{{ pageError || error }}</h1>
      <p>The documentation you are looking for could not be loaded.</p>
    </div>
  </div>

  <!-- Content -->
  <div v-else-if="doc" class="embed-shell">
    <!-- Sidebar: Outline -->
    <aside class="doc-sidebar" data-od-id="doc-sidebar">
      <a
        class="doc-sidebar-header"
        href="#guide-section-collection"
        @click.prevent="scrollToSection('guide-section-collection')"
      >
        <div class="doc-sidebar-title">{{ doc.collection.name }}</div>
        <div v-if="doc.collection.baseUrl" class="doc-sidebar-meta">
          <code class="base-url">{{ doc.collection.baseUrl }}</code>
        </div>
      </a>
      <ul v-if="outline.length > 0" class="doc-nav" role="list">
        <li v-for="item in outline" :key="item.id">
          <a
            :class="[
              'nav-item',
              item.type,
              { active: activeSectionId === item.id },
            ]"
            role="listitem"
            :href="'#' + item.id"
            @click.prevent="scrollToSection(item.id)"
          >
            <span
              v-if="item.type === 'endpoint' && item.method"
              class="method-dot"
              :style="{ backgroundColor: getMethodColor(item.method) }"
            />
            <span class="nav-label">{{ item.label }}</span>
          </a>
        </li>
      </ul>
    </aside>

    <!-- Main Content -->
    <main ref="guideContentRef" class="content" data-od-id="content">
      <article class="doc-body">
        <!-- Collection Header -->
        <div id="guide-section-collection" class="collection-header">
          <h1>{{ doc.collection.name }}</h1>
          <p v-if="doc.collection.description" class="collection-desc">
            {{ doc.collection.description }}
          </p>
          <div v-if="doc.collection.baseUrl" class="base-url-row">
            <span class="meta-label">Base URL</span>
            <code class="base-url-badge">{{ doc.collection.baseUrl }}</code>
          </div>
          <div class="stats-row">
            <span class="pill pill-green">{{ doc.stats.totalEndpoints }} endpoints</span>
            <span
              v-for="(count, method) in doc.stats.methods"
              :key="method"
              class="method-stat"
              :style="{ color: getMethodColor(method) }"
            >
              {{ method }} {{ count }}
            </span>
          </div>
        </div>

        <!-- Collection-level doc blocks -->
        <DocBlockRenderer
          v-for="block in collectionLevelBlocks"
          :key="block.id"
          :block="block"
          :base-url="doc.collection.baseUrl"
          :endpoints="doc.endpoints"
        />

        <!-- Root endpoints -->
        <div
          v-for="req in rootEndpoints"
          :id="`guide-section-endpoint-${req.id}`"
          :key="req.id"
          class="endpoint-section"
        >
          <DocBlockRenderer
            v-for="block in requestBlocksBefore(req.id)"
            :key="block.id"
            :block="block"
            :base-url="doc.collection.baseUrl"
            :endpoints="doc.endpoints"
          />
          <ApiEndpointBlock :endpoint="req" :base-url="doc.collection.baseUrl" />
          <DocBlockRenderer
            v-for="block in requestBlocksAfter(req.id)"
            :key="block.id"
            :block="block"
            :base-url="doc.collection.baseUrl"
            :endpoints="doc.endpoints"
          />
        </div>

        <!-- Folders -->
        <div v-for="folder in doc.folders" :key="folder.id" class="folder-group">
          <h2
            :id="`guide-section-folder-${folder.id}`"
            class="folder-header"
          >
            {{ folder.name }}
          </h2>

          <DocBlockRenderer
            v-for="block in folderBlocks(folder.id)"
            :key="block.id"
            :block="block"
            :base-url="doc.collection.baseUrl"
            :endpoints="doc.endpoints"
          />

          <div
            v-for="req in folder.requests"
            :id="`guide-section-endpoint-${req.id}`"
            :key="req.id"
            class="endpoint-section"
          >
            <DocBlockRenderer
              v-for="block in requestBlocksBefore(req.id)"
              :key="block.id"
              :block="block"
              :base-url="doc.collection.baseUrl"
              :endpoints="doc.endpoints"
            />
            <ApiEndpointBlock :endpoint="req" :base-url="doc.collection.baseUrl" />
            <DocBlockRenderer
              v-for="block in requestBlocksAfter(req.id)"
              :key="block.id"
              :block="block"
              :base-url="doc.collection.baseUrl"
              :endpoints="doc.endpoints"
            />
          </div>
        </div>
      </article>
    </main>
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
  --sidebar: 260px;
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

.api-docs-page {
  display: contents;
}

.embed-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ──────────────────────────────────────────────── */
.doc-sidebar {
  width: var(--sidebar);
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.doc-sidebar-header {
  display: block;
  padding: 20px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 2;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.doc-sidebar-header:hover {
  background: color-mix(in oklch, var(--fg) 5%, var(--surface));
}

.doc-sidebar-header:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.doc-sidebar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 6px;
  line-height: 1.3;
}

.doc-sidebar-meta {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.base-url {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.doc-nav {
  list-style: none;
  padding: 16px 12px 32px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-nav li {
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  border-radius: 6px;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
}

.nav-item:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 7%, transparent);
}

.nav-item.collection {
  font-weight: 700;
  color: var(--fg);
  font-size: 13.5px;
  margin-top: 0;
  padding-top: 6px;
}

.nav-item.folder {
  font-weight: 600;
  color: var(--fg);
  font-size: 13px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in oklch, var(--border) 60%, transparent);
}

.nav-item.endpoint {
  font-size: 12.5px;
}

.nav-item.active {
  color: var(--accent);
  font-weight: 600;
  background: color-mix(in oklch, var(--accent) 10%, var(--surface));
}

.nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5px;
  height: 18px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.method-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Content ──────────────────────────────────────────────── */
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

/* Collection Header */
.collection-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.collection-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--fg);
}

.collection-desc {
  font-size: 14px;
  color: var(--muted);
  margin: 0 0 12px;
  line-height: 1.6;
}

.base-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 500;
}

.base-url-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--bg);
  padding: 3px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--fg);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.method-stat {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

/* Folder Group */
.folder-group {
  margin-bottom: 40px;
}

.folder-header {
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  line-height: 1.3;
}

/* Endpoint Section */
.endpoint-section {
  margin-bottom: 24px;
  scroll-margin-top: 16px;
}

/* ── Loading Skeleton ─────────────────────────────────────── */
.loading-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.loading-sidebar {
  width: var(--sidebar);
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

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.sk-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.sk-title {
  display: block;
  width: 75%;
  height: 16px;
  margin-bottom: 8px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-meta {
  display: block;
  width: 55%;
  height: 12px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-nav {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sk-nav-item {
  display: block;
  height: 12px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-nav-item.indent {
  margin-left: 16px;
  width: calc(80% - 16px);
}

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
  display: block;
  width: 52px;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.sk-meta-text {
  display: block;
  width: 140px;
  height: 14px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-heading {
  display: block;
  width: 45%;
  height: 28px;
  margin: 32px 0 16px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-paragraph {
  display: block;
  width: 100%;
  height: 14px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.sk-code-block {
  display: block;
  width: 100%;
  height: 120px;
  margin: 16px 0;
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius);
  animation: shimmer 1.5s infinite;
}

/* ── Error ────────────────────────────────────────────────── */
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

/* ── Responsive ───────────────────────────────────────────── */
@media (max-width: 820px) {
  .doc-sidebar {
    width: 220px;
  }
  .content {
    padding: 24px;
  }
}

@media (max-width: 640px) {
  .doc-sidebar {
    display: none;
  }
  .content {
    padding: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
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
  html {
    scroll-behavior: auto;
  }
}
</style>
