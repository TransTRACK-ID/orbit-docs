import { toast } from "vue3-toastify";

export interface DocGenerationJob {
  id: string;
  appId: string;
  repoUrl: string;
  status: string;
  progressPct: number;
  progressMessage: string;
  repoRef: string | null;
  createdAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface DocGenerationResult {
  jobId: string;
  repoUrl: string;
  repoRef: string | null;
  status: string;
  srs: string | null;
  fsd: string | null;
  sdd: string | null;
  completedAt: string | null;
  versions?: DocGenerationVersion[];
}

export interface DocGenerationVersion {
  id: string;
  docType: "srs" | "fsd" | "sdd";
  content: string | null;
  actor: string | null;
  createdAt: string | null;
}

export interface DocGenerationPayload {
  repoUrl?: string;
}

export const useDocGenerator = () => {
  const jobs = ref<DocGenerationJob[]>([]);
  const currentJob = ref<DocGenerationJob | null>(null);
  const currentResult = ref<DocGenerationResult | null>(null);
  const isLoading = ref(false);
  const isGenerating = ref(false);
  const eventSource = ref<EventSource | null>(null);

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

  async function generateDocs(appId: string, payload: DocGenerationPayload) {
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
        repoUrl: payload.repoUrl || "",
        status: data.data.status,
        progressPct: data.data.progressPct,
        progressMessage: data.data.progressMessage,
        createdAt: data.data.createdAt,
        completedAt: null,
        errorMessage: null,
      };

      currentJob.value = job;
      jobs.value.unshift(job);

      toast.success("Document generation started");
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
    if (eventSource.value) {
      eventSource.value.close();
    }

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
          status: data.status,
          progressPct: data.progressPct,
          progressMessage: data.progressMessage,
          repoRef: data.repoRef ?? currentJob.value?.repoRef ?? null,
          completedAt: data.completedAt,
          errorMessage: data.errorMessage,
        } as DocGenerationJob;

        if (data.status === "completed" || data.status === "failed") {
          es.close();
          eventSource.value = null;

          if (data.status === "completed") {
            toast.success("Document generation completed!");
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
    payload: { srs?: string; fsd?: string; sdd?: string }
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

  function disconnectStream() {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
  }

  function clearCurrent() {
    currentJob.value = null;
    currentResult.value = null;
    disconnectStream();
  }

  return {
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
    updateResult,
    fetchResultVersions,
    disconnectStream,
    clearCurrent,
  };
};
