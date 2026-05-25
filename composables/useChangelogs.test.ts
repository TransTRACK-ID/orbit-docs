import { describe, expect, it, vi, beforeEach } from "vitest";
import { useChangelogs } from "./useChangelogs";

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

describe("useChangelogs composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch changelogs", async () => {
    const data = {
      data: [
        { id: "c1", appId: "a1", versionId: "v1", title: "Changelog 1", content: "## Fixed\n- Bug fix", status: "draft", createdBy: "User", createdAt: null, updatedAt: null, appName: "App", version: "1.0.0" },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { changelogs, fetchChangelogs, isLoading } = useChangelogs();
    await fetchChangelogs();

    expect(changelogs.value).toHaveLength(1);
    expect(changelogs.value[0].title).toBe("Changelog 1");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single changelog", async () => {
    const data = {
      data: { id: "c1", appId: "a1", versionId: "v1", title: "Changelog 1", content: "## Fixed\n- Bug fix", status: "draft", createdBy: "User", createdAt: null, updatedAt: null, appName: "App", version: "1.0.0" },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { changelog, fetchChangelog } = useChangelogs();
    const result = await fetchChangelog("c1");

    expect(result.title).toBe("Changelog 1");
    expect(changelog.value?.id).toBe("c1");
  });

  it("should fetch app changelogs", async () => {
    const data = {
      data: [
        { id: "c1", appId: "a1", versionId: "v1", title: "Changelog 1", content: "", status: "draft", createdBy: "User", createdAt: null, updatedAt: null, version: "1.0.0" },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { changelogs, fetchAppChangelogs, isLoading } = useChangelogs();
    await fetchAppChangelogs("a1");

    expect(changelogs.value).toHaveLength(1);
    expect(changelogs.value[0].appId).toBe("a1");
    expect(isLoading.value).toBe(false);
  });

  it("should create a changelog", async () => {
    const newChangelog = { id: "c2", appId: "a1", versionId: null, title: "New Changelog", content: "", status: "draft", createdBy: "User", createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: newChangelog });

    const { changelogs, createChangelog, isCreating } = useChangelogs();
    const result = await createChangelog({ appId: "a1", title: "New Changelog" });

    expect(result.title).toBe("New Changelog");
    expect(changelogs.value).toHaveLength(1);
    expect(isCreating.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Changelog created");
  });

  it("should update a changelog", async () => {
    const updated = { id: "c1", appId: "a1", versionId: null, title: "Updated", content: "## Added\n- Feature", status: "published", createdBy: "User", createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { changelogs, changelog, updateChangelog, isUpdating } = useChangelogs();
    changelogs.value = [{ id: "c1", appId: "a1", versionId: null, title: "Old", content: "", status: "draft", createdBy: "User", createdAt: null, updatedAt: null }];
    changelog.value = changelogs.value[0];

    const result = await updateChangelog("c1", { title: "Updated", content: "## Added\n- Feature", status: "published" });
    expect(result.title).toBe("Updated");
    expect(changelogs.value[0].title).toBe("Updated");
    expect(changelog.value.title).toBe("Updated");
    expect(isUpdating.value).toBe(false);
  });

  it("should delete a changelog", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { changelogs, deleteChangelog, isDeleting } = useChangelogs();
    changelogs.value = [{ id: "c1", appId: "a1", versionId: null, title: "Changelog", content: "", status: "draft", createdBy: "User", createdAt: null, updatedAt: null }];

    await deleteChangelog("c1");
    expect(changelogs.value).toHaveLength(0);
    expect(isDeleting.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Changelog deleted");
  });

  it("should handle 401 on fetchChangelogs", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchChangelogs } = useChangelogs();
    await fetchChangelogs();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });
});
