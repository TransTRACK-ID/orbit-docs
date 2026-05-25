import { describe, expect, it, vi, beforeEach } from "vitest";
import { useReleases } from "./useReleases";

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

describe("useReleases composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch releases", async () => {
    const data = {
      data: [
        { id: "r1", appId: "a1", versionId: "v1", heroTitle: "Release 1", summary: null, features: null, categories: null, published: false, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { releases, fetchReleases, isLoading } = useReleases();
    await fetchReleases();

    expect(releases.value).toHaveLength(1);
    expect(releases.value[0].heroTitle).toBe("Release 1");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single release", async () => {
    const data = {
      data: { id: "r1", appId: "a1", versionId: "v1", heroTitle: "Release 1", summary: null, features: null, categories: null, published: false, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { release, fetchRelease } = useReleases();
    const result = await fetchRelease("r1");

    expect(result.heroTitle).toBe("Release 1");
    expect(release.value?.id).toBe("r1");
  });

  it("should create a release", async () => {
    const newRelease = { id: "r2", appId: "a1", versionId: "v1", heroTitle: "New Release", summary: null, features: null, categories: null, published: false, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" };
    mockFetch.mockResolvedValueOnce({ data: newRelease });

    const { releases, createRelease, isCreating } = useReleases();
    const result = await createRelease({ appId: "a1", versionId: "v1", heroTitle: "New Release" });

    expect(result.heroTitle).toBe("New Release");
    expect(releases.value).toHaveLength(1);
    expect(isCreating.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Release created");
  });

  it("should update a release", async () => {
    const updated = { id: "r1", appId: "a1", versionId: "v1", heroTitle: "Updated", summary: "summary", features: null, categories: null, published: true, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { releases, release, updateRelease, isUpdating } = useReleases();
    releases.value = [{ id: "r1", appId: "a1", versionId: "v1", heroTitle: "Old", summary: null, features: null, categories: null, published: false, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" }];
    release.value = releases.value[0];

    const result = await updateRelease("r1", { heroTitle: "Updated", summary: "summary", published: true });
    expect(result.heroTitle).toBe("Updated");
    expect(releases.value[0].heroTitle).toBe("Updated");
    expect(release.value.heroTitle).toBe("Updated");
    expect(isUpdating.value).toBe(false);
  });

  it("should delete a release", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { releases, deleteRelease, isDeleting } = useReleases();
    releases.value = [{ id: "r1", appId: "a1", versionId: "v1", heroTitle: "Release", summary: null, features: null, categories: null, published: false, createdAt: null, updatedAt: null, appName: "App", version: "1.0.0", releaseDate: null, createdBy: null, versionStatus: "draft" }];

    await deleteRelease("r1");
    expect(releases.value).toHaveLength(0);
    expect(isDeleting.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Release deleted");
  });

  it("should handle 401 on fetchReleases", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchReleases } = useReleases();
    await fetchReleases();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });
});
