<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { apps, isLoading, fetchApps } = useApps();
const router = useRouter();

onMounted(() => {
  $page.setTitle("Generate Docs");
  fetchApps();
});

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 2419200)} months ago`;
}

const statusClass: Record<string, string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  maintenance: "Maintenance",
};
</script>

<template>
  <div class="generate-docs-landing">
    <header class="topbar">
      <div>
        <h1>Generate Docs</h1>
        <p class="subtitle">
          Select an app to generate SRS, FSD, and SDD from its repository
        </p>
      </div>
      <NuxtLink to="/docs" class="btn btn-ghost">
        &larr; Back to Docs
      </NuxtLink>
    </header>

    <div v-if="isLoading" class="app-grid">
      <div v-for="n in 4" :key="n" class="app-card skeleton">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="apps.length === 0" class="empty-state">
      <p>No apps available.</p>
      <NuxtLink to="/apps" class="btn btn-primary">
        Create an App
      </NuxtLink>
    </div>

    <div v-else class="app-grid">
      <div
        v-for="app in apps"
        :key="app.id"
        class="app-card"
      >
        <div class="app-card-header">
          <div class="app-card-title-row">
            <h3 class="app-card-title">{{ app.name }}</h3>
            <span class="pill" :class="statusClass[app.status] || 'pill-blue'">
              {{ statusLabel[app.status] || app.status }}
            </span>
          </div>
          <div class="app-card-meta">Updated {{ timeAgo(app.updatedAt) }}</div>
        </div>

        <div v-if="app.description" class="app-card-desc">
          {{ app.description }}
        </div>

        <div class="app-card-repo">
          <span v-if="app.repoUrl" class="repo-url">{{ app.repoUrl }}</span>
          <span v-else class="no-repo">No repository configured</span>
        </div>

        <div class="app-card-foot">
          <NuxtLink
            :to="`/docs/generate/${app.id}`"
            class="generate-hint btn btn-ghost btn-sm"
            @click.stop
          >
            Generate docs &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generate-docs-landing {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

@media (max-width: 720px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}

.app-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: inherit;
}

.app-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px color-mix(in oklch, var(--accent) 15%, transparent);
}

.app-card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
}

.app-card-meta {
  color: var(--muted);
  font-size: 12px;
}

.app-card-desc {
  font-size: 13px;
  color: var(--fg);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.app-card-repo {
  font-size: 12px;
  font-family: var(--font-mono);
}

.repo-url {
  color: var(--muted);
  word-break: break-all;
}

.no-repo {
  color: var(--muted);
  font-style: italic;
}

.app-card-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.generate-hint {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
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

.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
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
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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

.btn-ghost {
  background: transparent;
  color: var(--muted);
}

.btn-ghost:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 4%, transparent);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-ghost.generate-hint {
  color: var(--accent);
}

.skeleton {
  height: 160px;
}

@media (prefers-reduced-motion: reduce) {
  .app-card {
    transition: none;
  }
}
</style>
