import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePublishedDocs } from "./usePublishedDocs";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

const mockNavigateTo = vi.fn();
(globalThis as any).navigateTo = mockNavigateTo;

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue3-toastify", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

describe("usePublishedDocs composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch published docs", async () => {
    const data = {
      data: [
        { id: "p1", appId: "a1", title: "Published One", content: "content", status: "published", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { docs, fetchPublishedDocs, isLoading } = usePublishedDocs();
    await fetchPublishedDocs();

    expect(docs.value).toHaveLength(1);
    expect(docs.value[0].title).toBe("Published One");
    expect(docs.value[0].status).toBe("published");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single published doc", async () => {
    const data = {
      data: { id: "p1", appId: "a1", title: "Published One", content: "content", status: "published", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { currentDoc, fetchPublishedDoc } = usePublishedDocs();
    const result = await fetchPublishedDoc("p1");

    expect(result.title).toBe("Published One");
    expect(currentDoc.value?.id).toBe("p1");
  });

  it("should handle 401 on fetchPublishedDocs", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchPublishedDocs } = usePublishedDocs();
    await fetchPublishedDocs();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });

  it("should handle 404 on fetchPublishedDoc", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 404 });
    const { fetchPublishedDoc } = usePublishedDocs();
    await expect(fetchPublishedDoc("p1")).rejects.toEqual({ statusCode: 404 });
    expect(mockToastError).toHaveBeenCalledWith("Doc not found");
  });

  it("should handle 403 on fetchPublishedDoc", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 403 });
    const { fetchPublishedDoc } = usePublishedDocs();
    await expect(fetchPublishedDoc("p1")).rejects.toEqual({ statusCode: 403 });
    expect(mockToastError).toHaveBeenCalledWith("This document is not published");
  });
});
