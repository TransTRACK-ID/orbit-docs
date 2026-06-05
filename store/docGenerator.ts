import { defineStore } from "pinia";
import type { DocGenerationJob, DocGenerationResult } from "~/composables/useDocGenerator";

export const useDocGeneratorStore = defineStore("docGenerator", {
  state: () => ({
    jobs: [] as DocGenerationJob[],
    currentJob: null as DocGenerationJob | null,
    currentResult: null as DocGenerationResult | null,
    isLoading: false,
    isGenerating: false,
  }),

  getters: {
    completedJobs: (state) =>
      state.jobs.filter((j) => j.status === "completed"),
    pendingJobs: (state) =>
      state.jobs.filter(
        (j) => j.status !== "completed" && j.status !== "failed"
      ),
    latestJob: (state) =>
      state.jobs.length > 0 ? state.jobs[0] : null,
  },

  actions: {
    setJobs(jobs: DocGenerationJob[]) {
      this.jobs = jobs;
    },

    addJob(job: DocGenerationJob) {
      this.jobs.unshift(job);
    },

    updateJobStatus(jobId: string, status: Partial<DocGenerationJob>) {
      const idx = this.jobs.findIndex((j) => j.id === jobId);
      if (idx !== -1) {
        this.jobs[idx] = { ...this.jobs[idx], ...status };
      }
      if (this.currentJob?.id === jobId) {
        this.currentJob = { ...this.currentJob, ...status };
      }
    },

    setCurrentJob(job: DocGenerationJob | null) {
      this.currentJob = job;
    },

    setCurrentResult(result: DocGenerationResult | null) {
      this.currentResult = result;
    },

    setLoading(value: boolean) {
      this.isLoading = value;
    },

    setGenerating(value: boolean) {
      this.isGenerating = value;
    },

    clearCurrent() {
      this.currentJob = null;
      this.currentResult = null;
    },
  },
});
