<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Published Docs");
});

const { docs, isLoading, search, fetchPublishedDocs } = usePublishedDocs();
const { apps, fetchApps } = useApps();

const selectedApp = ref("");

onMounted(() => {
  fetchPublishedDocs();
  fetchApps();
});

function onSearch() {
  fetchPublishedDocs({ appId: selectedApp.value });
}

function onFilterApp() {
  fetchPublishedDocs({ appId: selectedApp.value });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 604800)} weeks ago`;
}
</script>

<template>
  <div class="docs-page">
    <header class="topbar">
      <h1>Published Docs</h1>
      <div style="display:flex;align-items:center;gap:16px;">
        <select v-model="selectedApp" class="filter-select" @change="onFilterApp">
          <option value="">All Apps</option>
          <option v-for="app in apps" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>
        <input
          v-model="search"
          class="search"
          placeholder="Search published docs…"
          aria-label="Search published docs"
          @input="onSearch"
        />
      </div>
    </header>

    <div v-if="isLoading" class="grid-3">
      <div v-for="n in 3" :key="n" class="card" style="height: 160px">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-2/3"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="docs.length === 0" class="empty-state">
      <p>No published docs found.</p>
      <NuxtLink to="/docs-editor" class="btn btn-primary" style="margin-top:12px;">
        Go to Doc Editor
      </NuxtLink>
    </div>

    <div v-else class="grid-3">
      <NuxtLink
        v-for="doc in docs"
        :key="doc.id"
        :to="`/docs-viewer/${doc.id}`"
        class="card link-card"
      >
        <div class="card-head">
          <div>
            <div class="card-title">{{ doc.title }}</div>
            <div class="card-meta">
              Updated {{ timeAgo(doc.updatedAt) }}
              <span v-if="doc.app">· {{ doc.app.name }}</span>
              <span v-if="doc.version">· v{{ doc.version.version }}</span>
            </div>
          </div>
          <span class="pill pill-green">Published</span>
        </div>
        <div v-if="doc.tags && doc.tags.length > 0" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          <span v-for="tag in doc.tags" :key="tag" class="pill pill-accent">{{ tag }}</span>
        </div>
        <div class="card-foot">
          <span style="color:var(--muted);font-size:12px;">{{ doc.author || 'Unknown' }}</span>
          <span style="color:var(--muted);font-size:12px;">{{ formatDate(doc.updatedAt) }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.docs-page {
  /* Inherits global semantic tokens from :root — no local overrides so dark mode works */
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

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  min-width: 160px;
}
.filter-select:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) {
  .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.link-card:hover {
  box-shadow: 0 1px 3px var(--fg-soft);
  transform: translateY(-1px);
}
.card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
}
.card-meta {
  color: var(--muted);
  font-size: 13px;
  margin-top: 4px;
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
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
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
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
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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

@media (max-width: 768px) {
  .search {
    width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .btn {
    transition: none !important;
  }
}
</style>
