<script setup lang="ts">
import { usePageStore } from "~/store/page";
import DocGeneratorForm from "~/components/docs/DocGeneratorForm.vue";
import DocResultViewer from "~/components/docs/DocResultViewer.vue";
import DocGenerationShareDrawer from "~/components/docs/DocGenerationShareDrawer.vue";
import RepositoryManager from "~/components/docs/RepositoryManager.vue";
import type { DocGenerationJob } from "~/composables/useDocGenerator";

definePageMeta({
  auth: true,
});

const route = useRoute();
const appId = route.params.id as string;

const $page = usePageStore();

// Agent configuration from public runtime config
const publicConfig = useRuntimeConfig().public;
const activeAgent = computed(() => (publicConfig.docAgent as string) || "opencode");
const defaultCursorModel = computed(() => (publicConfig.cursorModel as string) || "auto");
const isCursorActive = computed(() => activeAgent.value === "cursor");

// ── Agent status panel ──────────────────────────────────────────
const agentStatus = ref<{
  ok: boolean;
  message: string;
  instructions?: string;
  installed?: boolean;
  authenticated?: boolean;
  authMethod?: string;
  config?: { model?: string; hasApiKey?: boolean };
} | null>(null);
const isLoadingAgentStatus = ref(false);

async function fetchAgentStatus() {
  if (!isCursorActive.value) return;
  isLoadingAgentStatus.value = true;
  try {
    const data = await $fetch<{
      ok: boolean;
      message: string;
      instructions?: string;
      installed?: boolean;
      authenticated?: boolean;
      authMethod?: string;
      config?: { model?: string; hasApiKey?: boolean };
    }>("/api/agent/status");
    agentStatus.value = data;
  } catch (e: any) {
    agentStatus.value = {
      ok: false,
      message: e?.data?.message || "Failed to check agent status",
    };
  } finally {
    isLoadingAgentStatus.value = false;
  }
}

onMounted(() => {
  fetchAgentStatus();
});
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
  fetchDebugLogs,
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

// Track configured repositories so the Generate button can be enabled/disabled
const { repositories, fetchRepositories } = useAppRepositories();
const repoCount = computed(() => repositories.value.length);

onMounted(() => {
  $page.setTitle("Generate Docs");
  loadAppInfo();
  fetchRepositories(appId);
  fetchJobs(appId);
});

onBeforeUnmount(() => {
  clearCurrent();
});

// ── Submitting state shown before API returns ──────────────────
const isSubmitting = ref(false);

async function handleGenerate(payload?: { cursorModel?: string }) {
  isSubmitting.value = true;
  try {
    const job = await generateDocs(appId, payload || {});
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

function handleDebugJob(job: DocGenerationJob) {
  currentJob.value = job;
  showDebug.value = true;
  loadDebugLogs();
}

function handleCloseResult() {
  currentResult.value = null;
}

const resultJobId = computed(() => currentResult.value?.jobId || null);
const showShareDrawer = ref(false);
const isShareSaving = ref(false);

const {
  share: shareState,
  enableShare,
  disableShare,
  buildShareUrl,
  fetchCollaboration,
} = useDocGenerationCollaboration(toRef(() => appId), resultJobId);

const shareUrl = computed(() => {
  const token = shareState.value?.shareToken;
  if (!token) return "";
  return buildShareUrl(token);
});

async function handleOpenShare() {
  if (!resultJobId.value) return;
  await fetchCollaboration();
  showShareDrawer.value = true;
}

async function handleEnableShare() {
  isShareSaving.value = true;
  try {
    await enableShare();
  } finally {
    isShareSaving.value = false;
  }
}

async function handleDisableShare() {
  isShareSaving.value = true;
  try {
    await disableShare();
  } finally {
    isShareSaving.value = false;
  }
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

function jobScopeLabel(job: DocGenerationJob) {
  if (job.scope === "repo") {
    if (job.repoUrl) {
      const slug = job.repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
      const parts = slug.split("/");
      if (parts.length >= 2) return parts.slice(-2).join("/");
      return slug;
    }
    return "Repository SDD";
  }
  return "Product (all repos)";
}

const statusClass: Record<string, string> = {
  cloning: "pill-blue",
  analyzing: "pill-blue",
  generating_srs: "pill-accent",
  generating_fsd: "pill-accent",
  generating_git_snapshot: "pill-accent",
  generating_sdd_index: "pill-accent",
  generating_sdd: "pill-accent",
  writing_back: "pill-accent",
  completed: "pill-green",
  failed: "pill-danger",
  cancelled: "pill-muted",
};

const statusLabel: Record<string, string> = {
  cloning: "Cloning",
  analyzing: "Analyzing",
  generating_srs: "Generating SRS",
  generating_fsd: "Generating FSD",
  generating_git_snapshot: "Git Snapshot",
  generating_sdd_index: "SDD Index",
  generating_sdd: "Generating SDD",
  writing_back: "Writing back",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Friendly status for the progress header
const statusFull: Record<string, string> = {
  cloning: "Cloning repositories…",
  analyzing: "Analyzing codebases…",
  generating_srs: "Writing Software Requirements Specification…",
  generating_fsd: "Writing Functional Specification Document…",
  generating_git_snapshot: "Writing Git Snapshot reference…",
  generating_sdd_index: "Writing SDD index document…",
  generating_sdd: "Writing System Design Documents…",
  writing_back: "Opening pull requests…",
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

// Agent log entries — append each status / activity change as a timestamped line
interface LogEntry { ts: string; text: string; type: "info" | "activity" | "success" | "error" }
const agentLogs = ref<LogEntry[]>([]);
const logsEl = ref<HTMLElement | null>(null);

const pushLog = (text: string, type: LogEntry["type"]) => {
  if (!text) return;
  const last = agentLogs.value[agentLogs.value.length - 1];
  if (last && last.text === text && last.type === type) return;
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  agentLogs.value.push({ ts, text, type });
  nextTick(() => {
    if (logsEl.value) logsEl.value.scrollTop = logsEl.value.scrollHeight;
  });
};

// Status / progressMessage changes — coarse pipeline steps
watch(
  () => currentJob.value?.progressMessage,
  (msg, prev) => {
    if (!msg || msg === prev) return;
    const status = currentJob.value?.status;
    const type: LogEntry["type"] =
      status === "failed" ? "error" : status === "completed" ? "success" : "info";
    pushLog(msg, type);
  }
);

// Live agent activity — fine-grained tool calls / "Reading: …" / "Running: …"
watch(
  () => currentJob.value?.currentActivity,
  (activity) => {
    if (activity) pushLog(activity, "activity");
  }
);

// Clear logs when starting a new generation
watch(isSubmitting, (v) => {
  if (v) agentLogs.value = [];
});

// ── Stale detection: if no event for >60s while running, warn the user.
const now = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  nowTimer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer);
});

const secondsSinceLastEvent = computed(() => {
  const ts = currentJob.value?.lastEventAt;
  if (!ts) return null;
  const diff = Math.max(0, Math.floor((now.value - new Date(ts).getTime()) / 1000));
  return diff;
});
const isStale = computed(() => {
  if (!hasPendingJob.value) return false;
  const s = secondsSinceLastEvent.value;
  return s !== null && s > 60;
});

// Token usage display
const tokenSummary = computed(() => {
  const j = currentJob.value;
  if (!j) return null;
  const i = j.tokensInput ?? 0;
  const o = j.tokensOutput ?? 0;
  if (i === 0 && o === 0) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  return `${fmt(i)} in · ${fmt(o)} out`;
});

// Streamed preview (truncated to tail so we don't render 100k chars)
const previewText = computed(() => {
  const text = currentJob.value?.partialContent;
  if (!text) return "";
  const MAX = 4000;
  return text.length > MAX ? `…${text.slice(-MAX)}` : text;
});
const showPreview = ref(false);

// Auto-collapse preview when the job ends (final result has its own viewer).
watch(
  () => currentJob.value?.status,
  (s) => {
    if (s === "completed" || s === "failed" || s === "cancelled") {
      showPreview.value = false;
    }
  }
);

// ── Debug panel state ───────────────────────────────────────────
const showDebug = ref(false);
const debugLogs = ref<Array<{ id: string; eventType: string; eventData: Record<string, unknown>; createdAt: string }>>([]);
const debugMeta = ref({ total: 0, limit: 200, offset: 0 });
const isLoadingDebug = ref(false);
const debugPollTimer = ref<ReturnType<typeof setInterval> | null>(null);

async function loadDebugLogs() {
  if (!currentJob.value) return;
  isLoadingDebug.value = true;
  try {
    const res = await fetchDebugLogs(appId, currentJob.value.id, 200, 0);
    debugLogs.value = res.data;
    debugMeta.value = res.meta;
  } catch {
    // toast handled in composable
  } finally {
    isLoadingDebug.value = false;
  }
}

function startDebugPolling() {
  stopDebugPolling();
  loadDebugLogs();
  debugPollTimer.value = setInterval(loadDebugLogs, 3000);
}

function stopDebugPolling() {
  if (debugPollTimer.value) {
    clearInterval(debugPollTimer.value);
    debugPollTimer.value = null;
  }
}

watch(showDebug, (v) => {
  if (v && hasPendingJob.value) {
    startDebugPolling();
  } else {
    stopDebugPolling();
  }
});

onBeforeUnmount(() => {
  stopDebugPolling();
});

function formatDebugEvent(ev: { eventType: string; eventData: Record<string, unknown> }): string {
  switch (ev.eventType) {
    case "session.created":
      return `Session created: ${ev.eventData.sessionId}`;
    case "session.idle":
      return "Session idle (complete)";
    case "session.error":
      return `Session error: ${ev.eventData.message}`;
    case "message.part.updated": {
      const part = ev.eventData.part as Record<string, unknown> | undefined;
      if (!part) return "Message part updated";
      if (part.type === "text" && typeof part.text === "string") {
        const text = part.text as string;
        return `Text: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`;
      }
      if (part.type === "tool" && part.tool) {
        const state = part.state as Record<string, unknown> | undefined;
        return `Tool ${part.tool}: ${state?.status ?? "unknown"}`;
      }
      if (part.type === "step-finish") {
        const tokens = part.tokens as Record<string, number> | undefined;
        return `Step finish · ${tokens?.input ?? 0} in / ${tokens?.output ?? 0} out`;
      }
      if (part.type === "reasoning" && typeof part.text === "string") {
        const text = part.text as string;
        return `Reasoning: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`;
      }
      return `Part: ${part.type}`;
    }
    default:
      return ev.eventType;
  }
}
</script>

<template>
  <div class="generate-docs-page">
    <!-- Topbar -->
    <header class="topbar">
      <div>
        <div class="topbar-title-row">
          <h1>Generate Docs</h1>
          <span
            class="agent-badge"
            :class="`agent-badge--${activeAgent}`"
            :title="`Agent: ${activeAgent}${isCursorActive ? ' · Model: ' + defaultCursorModel : ''}`"
          >
            {{ activeAgent }}
          </span>
        </div>
        <p v-if="appInfo" class="app-name">{{ appInfo.name }}</p>
      </div>
      <NuxtLink to="/docs/generate" class="btn btn-ghost">
        &larr; All Apps
      </NuxtLink>
    </header>

    <!-- Agent Status Alert -->
    <div v-if="isCursorActive && agentStatus && !agentStatus.ok" class="agent-alert">
      <div class="agent-alert-header">
        <span class="agent-alert-icon" aria-hidden="true">!</span>
        <span class="agent-alert-title">Cursor Agent Not Ready</span>
      </div>
      <p class="agent-alert-msg">{{ agentStatus.message }}</p>
      <p v-if="agentStatus.instructions" class="agent-alert-instruction">
        {{ agentStatus.instructions }}
      </p>
      <div class="agent-alert-meta">
        <span v-if="agentStatus.installed === false" class="pill pill-danger">Not installed</span>
        <span v-else-if="agentStatus.authenticated === false" class="pill pill-danger">Not authenticated</span>
        <span v-if="agentStatus.config?.hasApiKey" class="pill pill-blue">API key configured</span>
      </div>
      <button class="btn btn-ghost btn-sm" @click="fetchAgentStatus">
        Check again
      </button>
    </div>

    <!-- Repositories -->
    <div class="form-section">
      <RepositoryManager :app-id="appId" />
    </div>

    <!-- Form -->
    <div class="form-section">
      <h2>New Generation</h2>
      <DocGeneratorForm
        :app-id="appId"
        :repo-count="repoCount"
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

        <!-- Live activity line + token/heartbeat meta ───────────────── -->
        <div v-if="hasPendingJob" class="live-meta">
          <div v-if="currentJob.currentActivity" class="activity-row" :class="{ stale: isStale }">
            <span class="activity-spinner" aria-hidden="true" />
            <span class="activity-text">{{ currentJob.currentActivity }}</span>
          </div>
          <div class="meta-row">
            <span v-if="tokenSummary" class="meta-pill" title="Token usage">
              {{ tokenSummary }} tokens
            </span>
            <span
              v-if="secondsSinceLastEvent !== null"
              class="meta-pill"
              :class="{ 'meta-warn': isStale }"
              :title="isStale ? 'No activity from agent recently' : 'Last agent event'"
            >
              {{ secondsSinceLastEvent }}s since last event
            </span>
            <button
              v-if="currentJob.partialContent"
              class="btn btn-ghost btn-sm preview-toggle"
              @click="showPreview = !showPreview"
            >
              {{ showPreview ? "Hide" : "Show" }} live output preview
            </button>
          </div>
          <p v-if="isStale" class="warn-msg">
            The agent hasn't produced output in over a minute. This can be normal for
            very large repos, but if it persists you may want to cancel and retry.
          </p>
        </div>

        <!-- Debug toggle -->
        <div class="meta-row" style="padding-top: 8px;">
          <button
            class="btn btn-ghost btn-sm preview-toggle"
            :class="{ active: showDebug }"
            @click="showDebug = !showDebug"
          >
            {{ showDebug ? "Hide" : "Debug" }} session
          </button>
        </div>

        <!-- Streamed live preview of the document currently being generated -->
        <pre v-if="hasPendingJob && showPreview && previewText" class="preview-pane">{{ previewText }}</pre>

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

      <!-- ─── Debug Session Panel ───────────────────────────────────── -->
      <div v-if="showDebug && currentJob" class="debug-panel">
        <div class="debug-header">
          <span class="debug-title">Debug Session</span>
          <div class="debug-meta">
            <span v-if="currentJob.opencodeSessionId" class="meta-pill" title="Agent session ID">
              {{ currentJob.opencodeSessionId }}
            </span>
            <span class="meta-pill">{{ debugMeta.total }} events</span>
            <button class="btn btn-ghost btn-sm" @click="loadDebugLogs">
              Refresh
            </button>
          </div>
        </div>

        <div v-if="isLoadingDebug && debugLogs.length === 0" class="debug-empty">
          Loading debug events…
        </div>

        <div v-else-if="debugLogs.length === 0" class="debug-empty">
          No debug events captured yet.
        </div>

        <div v-else class="debug-body">
          <div
            v-for="log in debugLogs"
            :key="log.id"
            class="debug-line"
            :class="`debug-${log.eventType.replace(/\./g, '-')}`"
          >
            <span class="debug-ts">{{ new Date(log.createdAt).toLocaleTimeString('en-US', { hour12: false }) }}</span>
            <span class="debug-type">{{ log.eventType }}</span>
            <span class="debug-text">{{ formatDebugEvent(log) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Result Viewer -->
    <div v-if="currentResult" class="result-section">
      <div class="result-header">
        <div class="result-heading">
          <h2>Generated documents</h2>
          <p class="result-subtitle">Review output, comment per document, or share a read-only link with stakeholders.</p>
        </div>
        <div class="result-header-actions">
          <button
            v-if="currentResult?.status === 'completed'"
            type="button"
            class="btn btn-ghost btn-sm"
            @click="handleOpenShare"
          >
            Share
          </button>
          <button type="button" class="btn btn-ghost btn-sm" @click="handleCloseResult">
            Close
          </button>
        </div>
      </div>
      <DocResultViewer
        :srs="currentResult.srs"
        :fsd="currentResult.fsd"
        :git-snapshot="currentResult.gitSnapshot"
        :sdd="currentResult.sdd"
        :repo-results="currentResult.repoResults"
        :app-id="appId"
        :job-id="currentResult.jobId"
      />
      <DocGenerationShareDrawer
        v-model:open="showShareDrawer"
        :share-enabled="shareState?.shareEnabled ?? false"
        :share-token="shareState?.shareToken ?? null"
        :share-url="shareUrl"
        :is-saving="isShareSaving"
        @enable="handleEnableShare"
        @disable="handleDisableShare"
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

      <div v-if="isLoading" class="table-panel">
        <table class="ds-table">
          <tbody>
            <tr v-for="n in 3" :key="n" class="skeleton-row">
              <td colspan="7"><div class="skeleton-bar w-two-thirds" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="jobs.length === 0" class="empty-state">
        <p>No generation jobs yet. Start your first one above.</p>
      </div>

      <GeneralDataTable v-else>
        <thead>
          <tr>
            <th>Scope</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Ref</th>
            <th>Trigger</th>
            <th>Created</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="job in jobs"
            :key="job.id"
            :class="{ 'is-selected': currentJob?.id === job.id, 'is-clickable': job.status === 'completed' }"
            @click="job.status === 'completed' && handleViewResult(job.id)"
          >
            <td>
              <div class="cell-stack">
                <span class="col-strong">{{ jobScopeLabel(job) }}</span>
                <span v-if="job.scope === 'repo' && job.repoUrl" class="col-muted col-truncate" :title="job.repoUrl">
                  {{ job.repoUrl }}
                </span>
              </div>
            </td>
            <td>
              <span class="pill" :class="statusClass[job.status] || 'pill-blue'">
                {{ statusLabel[job.status] || job.status }}
              </span>
            </td>
            <td>
              <div class="cell-stack">
                <div class="progress-inline">
                  <div class="progress-inline__bar" aria-hidden="true">
                    <div class="progress-inline__fill" :style="{ width: `${job.progressPct}%` }" />
                  </div>
                  <span class="progress-inline__pct">{{ job.progressPct }}%</span>
                </div>
                <span class="col-muted col-truncate" :title="job.progressMessage || undefined">
                  {{ job.progressMessage || statusLabel[job.status] || job.status }}
                </span>
              </div>
            </td>
            <td class="col-num col-muted">
              {{ job.repoRef || "—" }}
            </td>
            <td>
              <span class="pill" :class="job.trigger === 'webhook' ? 'pill-muted' : 'pill-blue'">
                {{ job.trigger === 'webhook' ? 'Webhook' : 'Manual' }}
              </span>
            </td>
            <td class="col-num col-muted">{{ formatDate(job.createdAt) }}</td>
            <td class="col-actions" @click.stop>
              <div class="cell-actions">
                <button
                  v-if="job.status === 'completed'"
                  class="btn btn-primary btn-sm"
                  @click="handleViewResult(job.id)"
                >
                  View
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  title="Debug session"
                  @click="handleDebugJob(job)"
                >
                  Debug
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  title="Remove from history"
                  @click="handleRemove(job.id)"
                >
                  Remove
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </GeneralDataTable>
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

.log-activity .log-text {
  color: var(--muted);
  font-style: italic;
}

.log-success .log-text {
  color: oklch(50% 0.14 145);
}

.log-error .log-text {
  color: oklch(50% 0.16 25);
}

/* ── Live activity row ─────────────────────────────────────────── */
.live-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in oklch, var(--fg) 6%, transparent);
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--fg);
  font-family: var(--font-mono, monospace);
  background: color-mix(in oklch, var(--accent) 6%, transparent);
  border-radius: var(--radius);
  padding: 8px 12px;
  border: 1px solid color-mix(in oklch, var(--accent) 18%, transparent);
}

.activity-row.stale {
  background: color-mix(in oklch, oklch(70% 0.16 75) 8%, transparent);
  border-color: color-mix(in oklch, oklch(70% 0.16 75) 30%, transparent);
}

.activity-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid color-mix(in oklch, var(--accent) 30%, transparent);
  border-top-color: var(--accent);
  animation: activity-spin 0.9s linear infinite;
  flex-shrink: 0;
}

.activity-row.stale .activity-spinner {
  animation-duration: 2.5s;
  border-top-color: oklch(70% 0.16 75);
}

@keyframes activity-spin {
  to { transform: rotate(360deg); }
}

.activity-text {
  word-break: break-all;
  line-height: 1.4;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  background: color-mix(in oklch, var(--fg) 6%, transparent);
  padding: 3px 10px;
  border-radius: 999px;
}

.meta-pill.meta-warn {
  background: color-mix(in oklch, oklch(70% 0.16 75) 14%, transparent);
  color: oklch(55% 0.14 75);
}

.preview-toggle {
  margin-left: auto;
}

.warn-msg {
  margin: 0;
  font-size: 12px;
  color: oklch(55% 0.14 75);
  line-height: 1.45;
}

/* ── Streaming preview pane ────────────────────────────────────── */
.preview-pane {
  margin: 0;
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  max-height: 280px;
  overflow-y: auto;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
  .activity-spinner {
    animation: none;
  }
}

/* ── Result & history sections ────────────────────────────────── */
.result-header,
.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.result-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.result-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.result-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
  max-width: 52ch;
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

.btn-ghost.active {
  color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, transparent);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

/* ── Debug panel ──────────────────────────────────────────────── */
.debug-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: color-mix(in oklch, var(--fg) 4%, transparent);
  border-bottom: 1px solid var(--border);
}

.debug-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.debug-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.debug-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.debug-body {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  padding: 12px 16px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.debug-line {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px solid color-mix(in oklch, var(--fg) 4%, transparent);
}

.debug-line:last-child {
  border-bottom: none;
}

.debug-ts {
  color: var(--muted);
  flex-shrink: 0;
  font-size: 11px;
  min-width: 64px;
}

.debug-type {
  color: var(--accent);
  flex-shrink: 0;
  font-size: 11px;
  min-width: 140px;
  font-weight: 500;
}

.debug-text {
  color: var(--fg);
  word-break: break-word;
  flex: 1;
}

.debug-session-error .debug-type {
  color: oklch(55% 0.16 25);
}

.debug-session-error .debug-text {
  color: oklch(50% 0.14 25);
}

.debug-session-idle .debug-type {
  color: oklch(50% 0.14 145);
}

/* ── Agent alert ──────────────────────────────────────────────── */
.agent-alert {
  background: color-mix(in oklch, oklch(55% 0.16 25) 6%, var(--bg));
  border: 1px solid color-mix(in oklch, oklch(55% 0.16 25) 25%, transparent);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-alert-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: oklch(55% 0.16 25);
  color: var(--surface);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.agent-alert-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.agent-alert-msg {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.agent-alert-instruction {
  margin: 0;
  font-size: 12px;
  color: var(--fg);
  font-family: var(--font-mono, monospace);
  background: color-mix(in oklch, var(--fg) 4%, transparent);
  padding: 8px 12px;
  border-radius: var(--radius);
  line-height: 1.5;
}

.agent-alert-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── Agent badge ──────────────────────────────────────────────── */
.topbar-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.agent-badge--opencode {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
  border-color: color-mix(in oklch, oklch(60% 0.16 255) 25%, transparent);
}

.agent-badge--cursor {
  background: color-mix(in oklch, oklch(60% 0.18 300) 12%, transparent);
  color: oklch(55% 0.16 300);
  border-color: color-mix(in oklch, oklch(60% 0.18 300) 25%, transparent);
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
