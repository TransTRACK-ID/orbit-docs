import { describe, expect, it, vi, beforeEach } from "vitest";
import { useVersions } from "./useVersions";

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

describe("useVersions composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch versions", async () => {
    const data = {
      data: [
        { id: "v1", appId: "a1", version: "1.0.0", status: "draft", createdBy: null, releaseDate: null, releaseNotes: null, branch: null, tags: null, commitHash: null, approver: null, ciStatus: "unknown", createdAt: null, updatedAt: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { versions, fetchVersions, isLoading } = useVersions();
    await fetchVersions("a1");

    expect(versions.value).toHaveLength(1);
    expect(versions.value[0].version).toBe("1.0.0");
    expect(isLoading.value).toBe(false);
  });

  it("should create a version", async () => {
    const newVersion = { id: "v2", appId: "a1", version: "2.0.0", status: "draft", createdBy: null, releaseDate: null, releaseNotes: null, branch: null, tags: null, commitHash: null, approver: null, ciStatus: "unknown", createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: newVersion });

    const { versions, createVersion, isCreating } = useVersions();
    const result = await createVersion("a1", { version: "2.0.0" });

    expect(result.version).toBe("2.0.0");
    expect(versions.value).toHaveLength(1);
    expect(isCreating.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Version 2.0.0 created");
  });

  it("should update a version", async () => {
    const updated = { id: "v1", appId: "a1", version: "1.0.1", status: "published", createdBy: null, releaseDate: null, releaseNotes: null, branch: null, tags: null, commitHash: null, approver: null, ciStatus: "unknown", createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { versions, updateVersion, isUpdating } = useVersions();
    versions.value = [{ id: "v1", appId: "a1", version: "1.0.0", status: "draft", createdBy: null, releaseDate: null, releaseNotes: null, branch: null, tags: null, commitHash: null, approver: null, ciStatus: "unknown", createdAt: null, updatedAt: null }];

    const result = await updateVersion("a1", "v1", { version: "1.0.1", status: "published" });
    expect(result.version).toBe("1.0.1");
    expect(versions.value[0].version).toBe("1.0.1");
    expect(isUpdating.value).toBe(false);
  });

  it("should delete a version", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { versions, deleteVersion, isDeleting } = useVersions();
    versions.value = [{ id: "v1", appId: "a1", version: "1.0.0", status: "draft", createdBy: null, releaseDate: null, releaseNotes: null, branch: null, tags: null, commitHash: null, approver: null, ciStatus: "unknown", createdAt: null, updatedAt: null }];

    await deleteVersion("a1", "v1");
    expect(versions.value).toHaveLength(0);
    expect(isDeleting.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Version deleted");
  });

  it("should handle 401 on fetchVersions", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchVersions } = useVersions();
    await fetchVersions("a1");
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });
});
