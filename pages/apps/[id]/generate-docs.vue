<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: true,
});

const route = useRoute();
const appId = route.params.id as string;

const $page = usePageStore();
const {
  jobs,
  currentJob,
  currentResult,
  isLoading,
  isGenerating,
  fetchJobs,
  generateDocs,
  connectToProgressStream,
  fetchResult,
  clearCurrent,
} = useDocGenerator();

// Fetch app info for display
const appInfo = ref<{ name: string; repoUrl: string | null } | null>(null);

async function loadAppInfo() {
  try {
    const data = await $fetch<{ data: { name: string; repoUrl: string | null } }>(
      `/api/apps/${appId}`
    );
    appInfo.value = data.data;
  } catch {
    appInfo.value = null;
  }
}

onMounted(() => {
  $page.setTitle("Generate Docs");
  loadAppInfo();
  fetchJobs(appId);
});

onBeforeUnmount(() => {
  clearCurrent();
});

async function handleGenerate(payload: { repoUrl: string }) {
  const job = await generateDocs(appId, { repoUrl: payload.repoUrl });
  connectToProgressStream(appId, job.id);
}

async function handleViewResult(jobId: string) {
  await fetchResult(appId, jobId);
}

function handleCloseResult() {
  currentResult.value = null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusClass: Record<string, string> = {
  cloning: "pill-blue",
  analyzing: "pill-blue",
  generating_srs: "pill-accent",
  generating_fsd: "pill-accent",
  generating_sdd: "pill-accent",
  completed: "pill-green",
  failed: "pill-danger",
};

const statusLabel: Record<string, string> = {
  cloning: "Cloning",
  analyzing: "Analyzing",
  generating_srs: "SRS",
  generating_fsd: "FSD",
  generating_sdd: "SDD",
  completed: "Done",
  failed: "Failed",
};

const hasPendingJob = computed(() => {
  if (!currentJob.value) return false;
  return (
    currentJob.value.status !== "completed" &&
    currentJob.value.status !== "failed"
  );
});

const isCompleted = computed(() => {
  if (!currentJob.value) return false;
  return currentJob.value.status === "completed";
});
</script>

<template>
  <div class="generate-docs-page">
    <!-- Topbar -->
    <header class="topbar">
      <div>
        <h1>Generate Docs</h1>
        <p v-if="appInfo" class="app-name">{{ appInfo.name }}</p>
      </div>
      <NuxtLink :to="`/apps/${appId}/versions`" class="btn btn-ghost">
        &larr; Back to App
      </NuxtLink>
    </header>

    <!-- Form -->
    <div class="form-section">
      <h2>New Generation</h2>
      <DocGeneratorForm
        :app-id="appId"
        :repo-url="appInfo?.repoUrl || undefined"
        :disabled="isGenerating || hasPendingJob"
        @generate="handleGenerate"
      />
    </div>

    <!-- Active Progress -->
    <div v-if="currentJob && hasPendingJob" class="progress-section">
      <h2>Generation Progress</h2>
      <DocGenerationProgress
        :progress-pct="currentJob.progressPct"
        :status="currentJob.status"
        :message="currentJob.progressMessage || ''"
        :error-message="currentJob.errorMessage"
      />
    </div>

    <!-- Result Viewer -->
    <div v-if="currentResult" class="result-section">
      <div class="result-header">
        <h2>Generated Documents</h2>
        <button class="btn btn-ghost" @click="handleCloseResult">
          Close
        </button>
      </div>
      <DocResultViewer
        :srs="currentResult.srs"
        :fsd="currentResult.fsd"
        :sdd="currentResult.sdd"
      />
    </div>

    <!-- Job History -->
    <div class="history-section">
      <div class="history-header">
        <h2>Generation History</h2>
        <button class="btn btn-ghost" @click="fetchJobs(appId)">
          Refresh
        </button>
      </div>

      <div v-if="isLoading" class="skeleton-list">
        <div v-for="n in 3" :key="n" class="skeleton-item">
          <div class="animate-pulse space-y-2">
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            <div class="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>

      <div v-else-if="jobs.length === 0" class="empty-state">
        <p>No generation jobs yet.</p>
      </div>

      <div v-else class="job-list">
        <div
          v-for="job in jobs"
          :key="job.id"
          class="job-item"
          :class="{ active: currentJob?.id === job.id }"
        >
          <div class="job-main">
            <div class="job-title-row">
              <span class="job-repo">{{ job.repoUrl }}</span>
              <span class="pill" :class="statusClass[job.status] || 'pill-blue'">
                {{ statusLabel[job.status] || job.status }}
              </span>
            </div>
            <div class="job-meta">
              <span class="num">{{ job.progressPct }}%</span>
              <span>{{ job.progressMessage || job.status }}</span>
              <span class="job-date">{{ formatDate(job.createdAt) }}</span>
            </div>
          </div>

          <div class="job-actions">
            <button
              v-if="job.status === 'completed'"
              class="btn btn-ghost btn-sm"
              @click="handleViewResult(job.id)"
            >
              View Results
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generate-docs-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.app-name {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.form-section,
.progress-section,
.result-section,
.history-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section h2,
.progress-section h2,
.result-section h2,
.history-section h2 {
  margin: 0;
  font-weight: 600;
  font-size: 16px;
  color: var(--fg);
}

.result-header,
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.job-item:hover {
  border-color: color-mix(in oklch, var(--fg) 20%, var(--border));
}

.job-item.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.job-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.job-repo {
  font-weight: 500;
  font-size: 14px;
  color: var(--fg);
  word-break: break-all;
}

.job-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--muted);
  flex-wrap: wrap;
}

.job-date {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.job-actions {
  flex-shrink: 0;
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

.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.pill-danger {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(50% 0.14 25);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
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
  background: transparent;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-ghost {
  color: var(--muted);
  border-color: transparent;
}

.btn-ghost:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 4%, transparent);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

@media (max-width: 768px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .job-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .job-actions {
    width: 100%;
  }
}
</style>
