<script setup lang="ts">
import { usePageStore } from "~/store/page";
import DocGenerationFloatingIndicator from "~/components/docs/DocGenerationFloatingIndicator.vue";
import type { FloatingGenerationJob } from "~/components/docs/DocGenerationFloatingIndicator.vue";
import {
  DOC_GENERATION_STATUS_LABEL,
} from "~/utils/doc-generation-status";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { apps, isLoading, fetchApps } = useApps();
const router = useRouter();
const {
  activeJobs,
  discoverAllActiveJobs,
  refreshAllActiveJobs,
  cancelJob,
} = useDocGenerator();

const POLL_MS = 5000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  $page.setTitle("Generate Docs");
  await fetchApps();
  if (apps.value.length > 0) {
    await discoverAllActiveJobs(apps.value.map((app) => app.id));
    startPolling();
  }
});

onBeforeUnmount(() => {
  stopPolling();
});

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (apps.value.length === 0) return;
    await refreshAllActiveJobs(apps.value.map((app) => app.id));
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

const appNameById = computed(() => {
  const map: Record<string, string> = {};
  for (const app of apps.value) map[app.id] = app.name;
  return map;
});

const runningJobByAppId = computed(() => {
  const map: Record<string, (typeof activeJobs.value)[number]> = {};
  for (const job of activeJobs.value) {
    map[job.appId] = job;
  }
  return map;
});

const floatingJobs = computed<FloatingGenerationJob[]>(() =>
  activeJobs.value.map((job) => ({
    appId: job.appId,
    appName: appNameById.value[job.appId] || "App",
    jobId: job.jobId,
    status: job.status,
    progressPct: job.progressPct,
    progressMessage: job.progressMessage,
    currentActivity: job.currentActivity,
  }))
);

function isAppGenerating(appId: string) {
  return !!runningJobByAppId.value[appId];
}

function runningPhase(appId: string) {
  const job = runningJobByAppId.value[appId];
  if (!job) return "";
  return DOC_GENERATION_STATUS_LABEL[job.status] || job.status;
}

function runningPct(appId: string) {
  return runningJobByAppId.value[appId]?.progressPct ?? 0;
}

function handleViewJob(appId: string) {
  router.push(`/docs/generate/${appId}`);
}

async function handleCancelJob(jobId: string, appId: string) {
  await cancelJob(appId, jobId);
  await refreshAllActiveJobs(apps.value.map((app) => app.id));
}

watch(
  () => activeJobs.value.length,
  (count) => {
    if (count > 0 && !pollTimer) startPolling();
    if (count === 0) stopPolling();
  }
);

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
        :class="{ 'app-card--generating': isAppGenerating(app.id) }"
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

        <div
          v-if="isAppGenerating(app.id)"
          class="app-card-progress"
          role="progressbar"
          :aria-valuenow="runningPct(app.id)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`${runningPhase(app.id)} for ${app.name}`"
        >
          <div class="app-card-progress__meta">
            <span class="app-card-progress__phase">{{ runningPhase(app.id) }}</span>
            <span class="app-card-progress__pct">{{ runningPct(app.id) }}%</span>
          </div>
          <div class="app-card-progress__track">
            <div
              class="app-card-progress__fill"
              :style="{ width: `${runningPct(app.id)}%` }"
            />
          </div>
        </div>

        <div class="app-card-foot">
          <NuxtLink
            :to="`/docs/generate/${app.id}`"
            class="generate-hint btn btn-ghost btn-sm"
            @click.stop
          >
            {{ isAppGenerating(app.id) ? "View progress" : "Generate docs" }} &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>

    <DocGenerationFloatingIndicator
      :jobs="floatingJobs"
      can-cancel
      @view-job="handleViewJob"
      @cancel="handleCancelJob"
    />
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
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: inherit;
}

.app-card:hover {
  border-color: color-mix(in oklch, var(--fg) 18%, var(--border));
}

.app-card--generating {
  border-color: color-mix(in oklch, oklch(60% 0.16 255) 28%, var(--border));
}

.app-card--generating:hover {
  border-color: color-mix(in oklch, oklch(60% 0.16 255) 40%, var(--border));
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

.app-card-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}

.app-card-progress__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.app-card-progress__phase {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--muted);
}

.app-card-progress__pct {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 600;
  color: oklch(55% 0.14 255);
}

.app-card-progress__track {
  width: 100%;
  height: 4px;
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  border-radius: 999px;
  overflow: hidden;
}

.app-card-progress__fill {
  height: 100%;
  background: oklch(60% 0.16 255);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.25, 1, 0.5, 1);
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
  flex-shrink: 0;
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
  .app-card,
  .app-card-progress__fill {
    transition: none;
  }
}
</style>
