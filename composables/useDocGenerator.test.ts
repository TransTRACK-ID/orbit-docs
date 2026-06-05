import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDocGenerator } from "./useDocGenerator";

// Mock vue3-toastify
vi.mock("vue3-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock navigateTo
vi.mock("#app", () => ({
  navigateTo: vi.fn(),
}));

describe("useDocGenerator composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct default state", () => {
    const { jobs, currentJob, currentResult, isLoading, isGenerating } =
      useDocGenerator();

    expect(jobs.value).toEqual([]);
    expect(currentJob.value).toBeNull();
    expect(currentResult.value).toBeNull();
    expect(isLoading.value).toBe(false);
    expect(isGenerating.value).toBe(false);
  });

  it("should clear current state correctly", () => {
    const { currentJob, currentResult, clearCurrent } = useDocGenerator();

    currentJob.value = {
      id: "test-id",
      appId: "app-id",
      repoUrl: "https://github.com/test/repo",
      status: "completed",
      progressPct: 100,
      progressMessage: "Done",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errorMessage: null,
    };
    currentResult.value = {
      jobId: "test-id",
      repoUrl: "https://github.com/test/repo",
      status: "completed",
      srs: "# SRS",
      fsd: "# FSD",
      sdd: "# SDD",
      completedAt: new Date().toISOString(),
    };

    clearCurrent();

    expect(currentJob.value).toBeNull();
    expect(currentResult.value).toBeNull();
  });

  it("should disconnect stream without error", () => {
    const { disconnectStream } = useDocGenerator();
    expect(() => disconnectStream()).not.toThrow();
  });
});
