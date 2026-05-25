<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ReleaseItem } from "~/composables/useReleases";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Releases");
});

const { apps, fetchApps } = useApps();
const { releases, isLoading, fetchReleases } = useReleases();

// Filters
const searchQuery = ref("");
const appFilter = ref("");

onMounted(async () => {
  await fetchApps();
  await fetchReleases();
});

watch([searchQuery, appFilter], async () => {
  await fetchReleases({
    search: searchQuery.value,
    app: appFilter.value,
  });
});

const filteredReleases = computed(() => {
  return releases.value;
});

const appFilterOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.name, label: a.name })),
]);

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function countCategories(categories: ReleaseItem["categories"]) {
  return {
    added: categories?.added?.length || 0,
    fixed: categories?.fixed?.length || 0,
    changed: categories?.changed?.length || 0,
    deprecated: categories?.deprecated?.length || 0,
    security: categories?.security?.length || 0,
  };
}

function renderPill(count: number, label: string, colorClass: string) {
  if (!count) return "";
  return `<span class="pill ${colorClass}">${count} ${label}</span>`;
}

const statusClass: Record<string, string> = {
  published: "pill-green",
  draft: "pill-blue",
  rc: "pill-amber",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  rc: "RC",
  archived: "Archived",
};

function mediaCount(r: ReleaseItem) {
  return (r.features || []).reduce((sum, f) => sum + (f.media || []).length, 0);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    searchQuery.value = "";
    appFilter.value = "";
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="releases-page">
    <!-- Topbar -->
    <header class="topbar">
      <div class="flex-gap-md">
        <h1>Releases</h1>
        <span class="text-muted-sm">Published release notes across all apps</span>
      </div>
      <div class="flex-gap-md">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search releases…"
          aria-label="Search releases"
        />
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="Filter by app…"
          search-placeholder="Search apps…"
        />

      </div>
    </header>

    <!-- Release list -->
    <main class="release-list">
      <div v-if="isLoading" class="release-item" style="opacity: 0.6;">
        <div class="release-date">—</div>
        <div class="release-body">
          <div class="release-header-row">
            <span class="release-title">Loading…</span>
          </div>
        </div>
      </div>

      <article
        v-for="r in filteredReleases"
        :key="r.id"
        class="release-item"
        :data-app="r.appName"
        :data-version="r.version"
      >
        <div class="release-date">{{ formatDate(r.releaseDate) }}</div>
        <div class="release-body">
          <div class="release-header-row">
            <NuxtLink :to="`/releases/${r.id}`" class="release-title">
              {{ r.appName }} {{ r.version }}
            </NuxtLink>
            <span class="pill" :class="r.type === 'article' ? 'pill-purple' : 'pill-muted'">
              {{ r.type === 'article' ? 'Article' : 'Normal' }}
            </span>
            <span v-if="mediaCount(r) > 0" class="pill pill-muted">{{ mediaCount(r) }} media</span>
            <span class="release-status">
              <span class="status-dot" :class="{
                'status-published': r.versionStatus === 'published',
                'status-draft': r.versionStatus === 'draft',
                'status-rc': r.versionStatus === 'rc',
                'status-archived': r.versionStatus === 'archived'
              }" />
              {{ statusLabel[r.versionStatus] || r.versionStatus }}
            </span>
          </div>
          <div class="release-summary" v-html="renderMarkdown(r.summary || r.heroTitle || '')" />
          <div class="release-meta-row">
            <span class="release-app">{{ r.appName }}</span>
            <span
              v-if="countCategories(r.categories).added"
              class="pill pill-green"
            >
              {{ countCategories(r.categories).added }} added
            </span>
            <span
              v-if="countCategories(r.categories).fixed"
              class="pill pill-blue"
            >
              {{ countCategories(r.categories).fixed }} fixed
            </span>
            <span
              v-if="countCategories(r.categories).changed"
              class="pill pill-amber"
            >
              {{ countCategories(r.categories).changed }} changed
            </span>
            <span
              v-if="countCategories(r.categories).deprecated"
              class="pill pill-purple"
            >
              {{ countCategories(r.categories).deprecated }} deprecated
            </span>
            <span
              v-if="countCategories(r.categories).security"
              class="pill pill-red"
            >
              {{ countCategories(r.categories).security }} security
            </span>
            <NuxtLink
              v-if="r.type === 'normal'"
              :to="`/changelogs?versionId=${r.versionId}`"
              class="btn btn-ghost btn-sm"
              style="margin-left: auto;"
              @click.stop
            >
              Edit changelog
            </NuxtLink>
            <NuxtLink
              v-else
              :to="`/releases/${r.id}?edit=1`"
              class="btn btn-ghost btn-sm"
              style="margin-left: auto;"
              @click.stop
            >
              Edit release
            </NuxtLink>
          </div>
        </div>
      </article>

      <div v-if="filteredReleases.length === 0 && !isLoading" class="empty-state">
        <p>No releases found</p>
        <span class="meta-label">Try adjusting your search or filter</span>
      </div>
    </main>
  </div>
</template>

<style scoped>
.releases-page {
  /* inherits global tokens */
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
}

.search {
  width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.search:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}

.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.select:focus {
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
  border-color: var(--accent);
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
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
  text-decoration: none;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
}

.release-list {
  max-width: 880px;
}

.release-item {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.release-item:hover .release-title {
  color: var(--accent);
}

.release-date {
  width: 120px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  padding-top: 2px;
}

.release-body {
  flex: 1;
  min-width: 0;
}

.release-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.release-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
}
.release-title:hover {
  color: var(--accent);
}

.release-summary {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
  margin: 4px 0 10px;
  max-height: 120px;
  overflow: hidden;
}
.release-summary:empty::before {
  content: "No summary provided.";
}
.release-summary > * {
  margin-bottom: 8px;
}
.release-summary > *:last-child {
  margin-bottom: 0;
}
.release-summary h2,
.release-summary h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  margin: 8px 0 4px;
}
.release-summary img {
  max-width: 100%;
  max-height: 80px;
  border-radius: 6px;
  object-fit: cover;
}
.release-summary ul {
  padding-left: 18px;
  margin: 4px 0;
}
.release-summary li {
  margin-bottom: 2px;
}
.release-summary blockquote {
  border-left: 2px solid var(--accent);
  padding-left: 10px;
  margin: 4px 0;
  font-style: italic;
}
.release-summary pre {
  background: var(--bg);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
.release-summary code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: var(--bg);
  padding: 1px 4px;
  border-radius: 3px;
}

.release-meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.release-app {
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.release-app::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
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
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-red {
  background: color-mix(in oklch, oklch(60% 0.18 25) 12%, transparent);
  color: oklch(55% 0.14 25);
}
.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.16 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

.empty-state {
  padding: 64px 24px;
  text-align: center;
  color: var(--muted);
}
.empty-state p {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--fg);
}

.meta-label {
  font-size: 12px;
  color: var(--muted);
}

/* Release status indicator */
.release-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.status-published {
  background: oklch(55% 0.14 145);
}
.status-draft {
  background: oklch(70% 0.14 85);
}
.status-rc {
  background: oklch(70% 0.14 85);
}
.status-archived {
  background: var(--muted);
}

@media (max-width: 768px) {
  .search {
    width: 180px;
  }
  .topbar {
    flex-wrap: wrap;
  }
  .release-item {
    flex-direction: column;
    gap: 12px;
  }
  .release-date {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .release-item,
  .release-title,
  .btn,
  .search,
  .select {
    transition: none !important;
  }
}
</style>
