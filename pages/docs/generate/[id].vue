<script setup lang="ts">
import { usePageStore } from "~/store/page";
import DocGeneratorForm from "~/components/docs/DocGeneratorForm.vue";
import DocResultViewer from "~/components/docs/DocResultViewer.vue";

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
  cancelJob,
  removeJob,
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

// ── Submitting state shown before API returns ──────────────────
const isSubmitting = ref(false);

async function handleGenerate(payload: { repoUrl: string }) {
  isSubmitting.value = true;
  try {
    const job = await generateDocs(appId, { repoUrl: payload.repoUrl });
    connectToProgressStream(appId, job.id);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleCancel(jobId: string) {
  await cancelJob(appId, jobId);
}

async function handleRemove(jobId: string) {
  await removeJob(appId, jobId);
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
  cancelled: "pill-muted",
};

const statusLabel: Record<string, string> = {
  cloning: "Cloning",
  analyzing: "Analyzing",
  generating_srs: "Generating SRS",
  generating_fsd: "Generating FSD",
  generating_sdd: "Generating SDD",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Friendly status for the progress header
const statusFull: Record<string, string> = {
  cloning: "Cloning repository…",
  analyzing: "Analyzing codebase…",
  generating_srs: "Writing Software Requirements Specification…",
  generating_fsd: "Writing Functional Specification Document…",
  generating_sdd: "Writing System Design Document…",
  completed: "All documents generated!",
  failed: "Generation failed",
  cancelled: "Generation cancelled",
};

const hasPendingJob = computed(() => {
  if (!currentJob.value) return false;
  return (
    currentJob.value.status !== "completed" &&
    currentJob.value.status !== "failed" &&
    currentJob.value.status !== "cancelled"
  );
});

const isCompleted = computed(() => currentJob.value?.status === "completed");
const isFailed = computed(() => currentJob.value?.status === "failed");

// Show progress panel if: submitting, actively generating, OR just completed/failed
const showProgress = computed(() => isSubmitting.value || !!currentJob.value);

// Agent log entries — append each status change as a timestamped line
interface LogEntry { ts: string; text: string; type: "info" | "success" | "error" }
const agentLogs = ref<LogEntry[]>([]);
const logsEl = ref<HTMLElement | null>(null);

watch(currentJob, (job) => {
  if (!job) return;
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  const text = job.progressMessage || statusFull[job.status] || job.status;
  const type = job.status === "failed" ? "error" : job.status === "completed" ? "success" : "info";

  // Only push if it's a new message
  const last = agentLogs.value[agentLogs.value.length - 1];
  if (!last || last.text !== text) {
    agentLogs.value.push({ ts, text, type });
    // Auto-scroll to bottom
    nextTick(() => {
      if (logsEl.value) logsEl.value.scrollTop = logsEl.value.scrollHeight;
    });
  }
}, { deep: true });

// Clear logs when starting a new generation
watch(isSubmitting, (v) => {
  if (v) agentLogs.value = [];
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
      <NuxtLink to="/docs/generate" class="btn btn-ghost">
        &larr; All Apps
      </NuxtLink>
    </header>

    <!-- Form -->
    <div class="form-section">
      <h2>New Generation</h2>
      <DocGeneratorForm
        :app-id="appId"
        :repo-url="appInfo?.repoUrl || undefined"
        :disabled="isSubmitting || isGenerating || hasPendingJob"
        @generate="handleGenerate"
      />
    </div>

    <!-- ─── Progress + Agent Logs panel ─────────────────────────── -->
    <div v-if="showProgress" class="progress-section">
      <h2>Generation Progress</h2>

      <!-- Submitting skeleton (before API returns) -->
      <div v-if="isSubmitting && !currentJob" class="progress-card">
        <div class="progress-header">
          <span class="status-text">Starting agent…</span>
          <span class="pct-text">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill indeterminate" />
        </div>
        <p class="progress-msg">Submitting request to the generation agent…</p>
      </div>

      <!-- Live progress -->
      <div v-else-if="currentJob" class="progress-card" :class="{ 'is-failed': isFailed, 'is-done': isCompleted }">
        <div class="progress-header">
          <span class="status-text">{{ statusFull[currentJob.status] || currentJob.status }}</span>
          <span class="pct-text">{{ currentJob.progressPct }}%</span>
        </div>
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            :style="{ width: `${currentJob.progressPct}%` }"
            :class="{ done: isCompleted, failed: isFailed }"
          />
        </div>
        <p v-if="currentJob.progressMessage" class="progress-msg">{{ currentJob.progressMessage }}</p>
        <p v-if="currentJob.errorMessage" class="error-msg">{{ currentJob.errorMessage }}</p>

        <!-- Cancel button when job is active -->
        <div v-if="hasPendingJob" class="progress-actions">
          <button class="btn btn-danger btn-sm" @click="handleCancel(currentJob!.id)">
            Cancel Generation
          </button>
        </div>

        <!-- View Results button right under bar when done -->
        <div v-if="isCompleted" class="progress-actions">
          <button class="btn btn-primary btn-sm" @click="handleViewResult(currentJob!.id)">
            View Generated Documents
          </button>
        </div>
      </div>

      <!-- Agent logs terminal -->
      <div class="agent-logs">
        <div class="logs-header">
          <span class="logs-title">
            <span class="logs-dot" :class="{ active: hasPendingJob, done: isCompleted, failed: isFailed }" />
            Agent Logs
          </span>
          <span class="logs-count">{{ agentLogs.length }} events</span>
        </div>
        <div ref="logsEl" class="logs-body">
          <div v-if="agentLogs.length === 0" class="log-empty">Waiting for agent output…</div>
          <div
            v-for="(entry, i) in agentLogs"
            :key="i"
            class="log-line"
            :class="`log-${entry.type}`"
          >
            <span class="log-ts">{{ entry.ts }}</span>
            <span class="log-text">{{ entry.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Result Viewer -->
    <div v-if="currentResult" class="result-section">
      <div class="result-header">
        <h2>Generated Documents</h2>
        <button class="btn btn-ghost btn-sm" @click="handleCloseResult">
          Close
        </button>
      </div>
      <DocResultViewer
        :srs="currentResult.srs"
        :fsd="currentResult.fsd"
        :sdd="currentResult.sdd"
        :app-id="appId"
      />
    </div>

    <!-- Job History -->
    <div class="history-section">
      <div class="history-header">
        <h2>Generation History</h2>
        <button class="btn btn-ghost btn-sm" @click="fetchJobs(appId)">
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
        <p>No generation jobs yet. Start your first one above.</p>
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
              <span v-if="job.repoRef" class="job-ref" title="Tag or commit hash">{{ job.repoRef }}</span>
              <span class="job-date">{{ formatDate(job.createdAt) }}</span>
            </div>
          </div>

          <div class="job-actions">
            <button
              v-if="job.status === 'completed'"
              class="btn btn-primary btn-sm"
              @click="handleViewResult(job.id)"
            >
              View Results
            </button>
            <button
              class="btn btn-ghost btn-sm"
              title="Remove from history"
              @click="handleRemove(job.id)"
            >
              Remove
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

/* ── Progress card ────────────────────────────────────────────── */
.progress-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s;
}

.progress-card.is-failed {
  border-color: oklch(55% 0.18 25);
}

.progress-card.is-done {
  border-color: oklch(60% 0.18 145);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.pct-text {
  font-size: 14px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--muted);
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-bar-fill.done {
  background: oklch(60% 0.18 145);
}

.progress-bar-fill.failed {
  background: oklch(55% 0.18 25);
}

/* Indeterminate (before first SSE) */
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.5); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.5); }
}

.progress-bar-fill.indeterminate {
  width: 40% !important;
  animation: indeterminate 1.4s ease-in-out infinite;
  transform-origin: left center;
}

.progress-msg {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.error-msg {
  margin: 0;
  font-size: 13px;
  color: oklch(50% 0.16 25);
}

.progress-actions {
  padding-top: 4px;
}

/* ── Agent logs terminal ───────────────────────────────────────── */
.agent-logs {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: color-mix(in oklch, var(--fg) 4%, transparent);
  border-bottom: 1px solid var(--border);
}

.logs-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.logs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  transition: background 0.3s;
}

.logs-dot.active {
  background: oklch(60% 0.2 145);
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(60% 0.2 145) 25%, transparent);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.logs-dot.done {
  background: oklch(60% 0.18 145);
}

.logs-dot.failed {
  background: oklch(55% 0.18 25);
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in oklch, oklch(60% 0.2 145) 25%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in oklch, oklch(60% 0.2 145) 10%, transparent); }
}

.logs-count {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);
}

.logs-body {
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
  font-family: var(--font-mono, monospace);
  font-size: 12.5px;
  line-height: 1.6;
  padding: 12px 16px;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-empty {
  color: var(--muted);
  font-style: italic;
}

.log-line {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.log-ts {
  color: var(--muted);
  flex-shrink: 0;
  font-size: 11px;
}

.log-text {
  color: var(--fg);
  word-break: break-word;
}

.log-info .log-text {
  color: var(--fg);
}

.log-success .log-text {
  color: oklch(50% 0.14 145);
}

.log-error .log-text {
  color: oklch(50% 0.16 25);
}

/* ── Result & history sections ────────────────────────────────── */
.result-header,
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-state {
  text-align: center;
  padding: 32px 0;
  color: var(--muted);
  font-size: 13px;
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
  gap: 6px;
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
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
}

.job-ref {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  background: color-mix(in oklch, var(--fg) 6%, transparent);
  color: var(--muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.job-date {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.job-actions {
  flex-shrink: 0;
}

/* ── Pills ────────────────────────────────────────────────────── */
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

.pill-muted {
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  color: var(--muted);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* ── Buttons ──────────────────────────────────────────────────── */
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
  text-decoration: none;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
}

.btn-danger {
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}

.btn-danger:hover {
  background: oklch(50% 0.18 25);
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

/* ── Responsive ───────────────────────────────────────────────── */
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

@media (prefers-reduced-motion: reduce) {
  .progress-bar-fill,
  .progress-bar-fill.indeterminate {
    animation: none;
    transition: none;
  }
}
</style>
