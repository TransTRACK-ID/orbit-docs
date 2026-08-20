import { toast } from "vue3-toastify";
import { isPendingDocGenerationStatus } from "~/utils/doc-generation-status";

export interface DocGenerationJob {
  id: string;
  appId: string;
  repoUrl: string | null;
  scope?: "product" | "repo" | "wiki";
  trigger?: "manual" | "webhook" | "scheduled";
  status: string;
  progressPct: number;
  progressMessage: string;
  repoRef: string | null;
  createdAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  // ── Live progress, populated by the SSE status stream while the agent runs.
  currentActivity?: string | null;
  partialContent?: string | null;
  lastEventAt?: string | null;
  tokensInput?: number;
  tokensOutput?: number;
  opencodeSessionId?: string | null;
}

export interface DebugLogEntry {
  id: string;
  jobId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
}

export interface DocGenerationRepoResult {
  id: string;
  repoId: string | null;
  repoUrl: string;
  repoRef: string | null;
  sdd: string | null;
  status: string;
  prUrl: string | null;
  prStatus?: string | null;
  mergeErrorMessage?: string | null;
  errorMessage: string | null;
}

export interface DocGenerationResult {
  jobId: string;
  appId?: string;
  appName?: string;
  repoUrl: string | null;
  repoRef: string | null;
  scope?: "product" | "repo" | "wiki";
  status: string;
  srs: string | null;
  fsd: string | null;
  gitSnapshot: string | null;
  sdd: string | null;
  completedAt: string | null;
  repoResults?: DocGenerationRepoResult[];
  versions?: DocGenerationVersion[];
}

export interface DocGenerationVersion {
  id: string;
  docType: "srs" | "fsd" | "git_snapshot" | "sdd" | "sdd_index";
  content: string | null;
  actor: string | null;
  createdAt: string | null;
}

export interface DocGenerationPayload {
  repoUrl?: string;
  cursorModel?: string;
  scope?: "product" | "wiki";
}

export interface TrackedActiveJob {
  appId: string;
  jobId: string;
  status: string;
  progressPct: number;
  progressMessage: string;
  currentActivity?: string | null;
}

export const useDocGenerator = () => {
  const jobs = useState<DocGenerationJob[]>("doc-gen-jobs", () => []);
  const currentJob = useState<DocGenerationJob | null>("doc-gen-current-job", () => null);
  const currentResult = useState<DocGenerationResult | null>("doc-gen-current-result", () => null);
  const isLoading = ref(false);
  const isGenerating = ref(false);
  const eventSource = useState<EventSource | null>("doc-gen-event-source", () => null);
  const trackedAppId = useState<string | null>("doc-gen-tracked-app-id", () => null);
  const activeJobs = useState<TrackedActiveJob[]>("doc-gen-active-jobs", () => []);

  async function fetchJobs(appId: string, limit?: number, offset?: number) {
    isLoading.value = true;
    try {
      const query: Record<string, string> = {};
      if (limit) query.limit = String(limit);
      if (offset !== undefined) query.offset = String(offset);

      const data = await $fetch<{ data: DocGenerationJob[] }>(
        `/api/apps/${appId}/generate-docs`,
        { query: Object.keys(query).length ? query : undefined }
      );
      jobs.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load generation jobs");
      }
      console.error(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function generateDocs(appId: string, payload: DocGenerationPayload = {}) {
    isGenerating.value = true;
    try {
      const data = await $fetch<{
        data: {
          jobId: string;
          status: string;
          progressPct: number;
          progressMessage: string;
          createdAt: string;
        };
      }>(`/api/apps/${appId}/generate-docs`, {
        method: "POST",
        body: payload,
      });

      const job: DocGenerationJob = {
        id: data.data.jobId,
        appId,
        repoUrl: payload.repoUrl || null,
        scope: payload.scope || "product",
        status: data.data.status,
        progressPct: data.data.progressPct,
        progressMessage: data.data.progressMessage,
        createdAt: data.data.createdAt,
        completedAt: null,
        errorMessage: null,
      };

      currentJob.value = job;
      jobs.value.unshift(job);
      upsertActiveJob({
        appId,
        jobId: job.id,
        status: job.status,
        progressPct: job.progressPct,
        progressMessage: job.progressMessage,
      });

      toast.success(
        payload.scope === "wiki"
          ? "Wiki site generation started"
          : "Document generation started",
      );
      return job;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to start generation";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      console.error(e);
      throw e;
    } finally {
      isGenerating.value = false;
    }
  }

  function connectToProgressStream(appId: string, jobId: string) {
    if (
      eventSource.value &&
      trackedAppId.value === appId &&
      currentJob.value?.id === jobId
    ) {
      return eventSource.value;
    }

    if (eventSource.value) {
      eventSource.value.close();
    }

    trackedAppId.value = appId;

    const es = new EventSource(
      `/api/apps/${appId}/generate-docs/${jobId}/status`
    );
    eventSource.value = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        currentJob.value = {
          ...(currentJob.value || {}),
          id: jobId,
          appId,
          scope: currentJob.value?.scope ?? jobs.value.find((j) => j.id === jobId)?.scope,
          status: data.status,
          progressPct: data.progressPct,
          progressMessage: data.progressMessage,
          repoRef: data.repoRef ?? currentJob.value?.repoRef ?? null,
          completedAt: data.completedAt,
          errorMessage: data.errorMessage,
          currentActivity: data.currentActivity ?? null,
          partialContent: data.partialContent ?? null,
          lastEventAt: data.lastEventAt ?? null,
          tokensInput: data.tokensInput ?? 0,
          tokensOutput: data.tokensOutput ?? 0,
        } as DocGenerationJob;

        const idx = jobs.value.findIndex((j) => j.id === jobId);
        if (idx !== -1) {
          jobs.value[idx] = {
            ...jobs.value[idx],
            ...currentJob.value,
          };
        }

        if (isPendingDocGenerationStatus(data.status)) {
          upsertActiveJob({
            appId,
            jobId,
            status: data.status,
            progressPct: data.progressPct,
            progressMessage: data.progressMessage,
            currentActivity: data.currentActivity ?? null,
          });
        } else {
          removeActiveJob(jobId);
        }

        if (data.status === "completed" || data.status === "failed") {
          es.close();
          eventSource.value = null;
          trackedAppId.value = null;

          if (data.status === "completed") {
            const scope = currentJob.value?.scope;
            toast.success(
              scope === "wiki" ? "Wiki site generation completed!" : "Document generation completed!",
            );
          } else {
            toast.error(data.errorMessage || "Generation failed");
          }
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };

    es.onerror = () => {
      es.close();
      eventSource.value = null;
    };

    return es;
  }

  function resumeProgressStreamIfNeeded(appId: string) {
    const job = currentJob.value;
    if (!job || job.appId !== appId) return;
    if (!isPendingDocGenerationStatus(job.status)) return;
    connectToProgressStream(appId, job.id);
  }

  async function cancelJob(appId: string, jobId: string) {
    try {
      await $fetch(`/api/apps/${appId}/generate-docs/${jobId}`, {
        method: "PATCH",
      });

      // Update local state
      const idx = jobs.value.findIndex((j) => j.id === jobId);
      if (idx !== -1) {
        jobs.value[idx] = {
          ...jobs.value[idx],
          status: "cancelled",
          progressPct: 0,
          progressMessage: "Cancelled by user",
        };
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = {
          ...currentJob.value,
          status: "cancelled",
          progressPct: 0,
          progressMessage: "Cancelled by user",
        };
      }
      removeActiveJob(jobId);

      disconnectStream();
      toast.success("Generation cancelled");
      return true;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to cancel generation";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      console.error(e);
      throw e;
    }
  }

  async function removeJob(appId: string, jobId: string) {
    try {
      await $fetch(`/api/apps/${appId}/generate-docs/${jobId}`, {
        method: "DELETE",
      });

      // Remove from local list
      jobs.value = jobs.value.filter((j) => j.id !== jobId);

      // Clear current if it was the removed job
      if (currentJob.value?.id === jobId) {
        currentJob.value = null;
        disconnectStream();
      }
      if (currentResult.value?.jobId === jobId) {
        currentResult.value = null;
      }

      toast.success("Job removed from history");
      return true;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to remove job";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchResult(appId: string, jobId: string) {
    try {
      const data = await $fetch<{ data: DocGenerationResult }>(
        `/api/apps/${appId}/generate-docs/${jobId}/result`
      );
      currentResult.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load generation result");
      }
      console.error(e);
      throw e;
    }
  }

  async function updateResult(
    appId: string,
    jobId: string,
    payload: { srs?: string; fsd?: string; sdd?: string; gitSnapshot?: string }
  ) {
    try {
      const data = await $fetch<{ data: { success: boolean; message: string; jobId: string } }>(
        `/api/apps/${appId}/generate-docs/${jobId}/result`,
        {
          method: "PUT",
          body: payload,
        }
      );
      toast.success(data.data.message);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update generation result";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchResultVersions(appId: string, jobId: string) {
    try {
      const data = await $fetch<{ data: DocGenerationVersion[] }>(
        `/api/apps/${appId}/generate-docs/${jobId}/versions`
      );
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load generation versions");
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchDebugLogs(appId: string, jobId: string, limit = 200, offset = 0) {
    try {
      const data = await $fetch<{
        data: DebugLogEntry[];
        meta: { total: number; limit: number; offset: number };
      }>(`/api/apps/${appId}/generate-docs/${jobId}/debug`, {
        query: { limit: String(limit), offset: String(offset) },
      });
      return data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load debug logs");
      }
      console.error(e);
      throw e;
    }
  }

  function disconnectStream() {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
    trackedAppId.value = null;
  }

  function clearCurrent() {
    currentJob.value = null;
    currentResult.value = null;
    disconnectStream();
  }

  function dismissFloatingIndicator() {
    if (currentJob.value && isPendingDocGenerationStatus(currentJob.value.status)) {
      return;
    }
    currentJob.value = null;
  }

  function upsertActiveJob(entry: TrackedActiveJob) {
    const idx = activeJobs.value.findIndex((j) => j.jobId === entry.jobId);
    if (idx === -1) {
      activeJobs.value = [...activeJobs.value, entry];
      return;
    }
    const next = [...activeJobs.value];
    next[idx] = { ...next[idx], ...entry };
    activeJobs.value = next;
  }

  function removeActiveJob(jobId: string) {
    activeJobs.value = activeJobs.value.filter((j) => j.jobId !== jobId);
  }

  async function discoverAllActiveJobs(appIds: string[]) {
    const found: TrackedActiveJob[] = [];

    await Promise.all(
      appIds.map(async (appId) => {
        try {
          const data = await $fetch<{ data: DocGenerationJob[] }>(
            `/api/apps/${appId}/generate-docs`,
            { query: { limit: "5" } }
          );
          const active = data.data.find((job) => isPendingDocGenerationStatus(job.status));
          if (active) {
            found.push({
              appId,
              jobId: active.id,
              status: active.status,
              progressPct: active.progressPct,
              progressMessage: active.progressMessage,
              currentActivity: active.currentActivity ?? null,
            });
          }
        } catch {
          // Skip apps we cannot read.
        }
      })
    );

    activeJobs.value = found;

    if (found.length > 0 && !currentJob.value) {
      const first = found[0];
      currentJob.value = {
        id: first.jobId,
        appId: first.appId,
        repoUrl: null,
        status: first.status,
        progressPct: first.progressPct,
        progressMessage: first.progressMessage,
        repoRef: null,
        createdAt: null,
        completedAt: null,
        errorMessage: null,
        currentActivity: first.currentActivity ?? null,
      };
    }

    if (currentJob.value && isPendingDocGenerationStatus(currentJob.value.status)) {
      resumeProgressStreamIfNeeded(currentJob.value.appId);
    }

    return found;
  }

  async function refreshAllActiveJobs(appIds: string[]) {
    return discoverAllActiveJobs(appIds);
  }

  const hasPendingJob = computed(() => {
    if (!currentJob.value) return false;
    return isPendingDocGenerationStatus(currentJob.value.status);
  });

  return {
    jobs,
    currentJob,
    currentResult,
    activeJobs,
    isLoading,
    isGenerating,
    hasPendingJob,
    fetchJobs,
    generateDocs,
    connectToProgressStream,
    resumeProgressStreamIfNeeded,
    cancelJob,
    removeJob,
    fetchResult,
    updateResult,
    fetchResultVersions,
    fetchDebugLogs,
    disconnectStream,
    clearCurrent,
    dismissFloatingIndicator,
    discoverAllActiveJobs,
    refreshAllActiveJobs,
  };
};
