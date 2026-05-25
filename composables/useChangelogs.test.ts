import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("should have default state", () => {
    const {
      changelogs,
      changelog,
      history,
      isLoading,
      isCreating,
      isUpdating,
      isDeleting,
      isSaving,
    } = useChangelogs();

    expect(changelogs.value).toEqual([]);
    expect(changelog.value).toBeNull();
    expect(history.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(isCreating.value).toBe(false);
    expect(isUpdating.value).toBe(false);
    expect(isDeleting.value).toBe(false);
    expect(isSaving.value).toBe(false);
  });

  it("should fetch changelogs", async () => {
    const { changelogs, isLoading, fetchChangelogs } = useChangelogs();
    const mockData = [
      {
        id: "1",
        appId: "app-1",
        versionId: "v-1",
        content: "## v1.0.0",
        status: "draft",
        author: "Alice",
        appName: "API Gateway",
        version: "1.0.0",
      },
    ];

    mockFetch.mockResolvedValueOnce({ data: mockData });

    await fetchChangelogs();
    expect(isLoading.value).toBe(false);
    expect(changelogs.value).toEqual(mockData);
  });

  it("should handle 401 on fetchChangelogs", async () => {
    const { isLoading, fetchChangelogs } = useChangelogs();

    mockFetch.mockRejectedValueOnce({ statusCode: 401 });

    await fetchChangelogs();
    expect(isLoading.value).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });

  it("should create a changelog", async () => {
    const { changelogs, isCreating, createChangelog } = useChangelogs();
    const mockData = {
      id: "2",
      appId: "app-1",
      versionId: null,
      content: "",
      status: "draft",
      author: "Bob",
      appName: "API Gateway",
      version: null,
    };

    mockFetch.mockResolvedValueOnce({ data: mockData });

    const result = await createChangelog({ appId: "app-1" });
    expect(isCreating.value).toBe(false);
    expect(changelogs.value).toContainEqual(mockData);
    expect(result).toEqual(mockData);
    expect(mockToastSuccess).toHaveBeenCalledWith("Changelog created");
  });

  it("should update a changelog", async () => {
    const { changelogs, isUpdating, updateChangelog } = useChangelogs();
    changelogs.value = [
      { id: "1", appId: "app-1", versionId: null, content: "old", status: "draft", author: "Alice", appName: "API Gateway", version: null },
    ];
    const mockData = { id: "1", appId: "app-1", versionId: null, content: "new", status: "draft", author: "Alice", appName: "API Gateway", version: null };

    mockFetch.mockResolvedValueOnce({ data: mockData });

    await updateChangelog("1", { content: "new" });
    expect(isUpdating.value).toBe(false);
    expect(changelogs.value[0].content).toBe("new");
    expect(mockToastSuccess).toHaveBeenCalledWith("Changelog updated");
  });

  it("should delete a changelog", async () => {
    const { changelogs, isDeleting, deleteChangelog } = useChangelogs();
    changelogs.value = [
      { id: "1", appId: "app-1", versionId: null, content: "", status: "draft", author: "Alice", appName: "API Gateway", version: null },
    ];

    mockFetch.mockResolvedValueOnce({ success: true });

    await deleteChangelog("1");
    expect(isDeleting.value).toBe(false);
    expect(changelogs.value.length).toBe(0);
    expect(mockToastSuccess).toHaveBeenCalledWith("Changelog deleted");
  });

  it("should handle generic error on fetchChangelogs", async () => {
    const { isLoading, fetchChangelogs } = useChangelogs();

    mockFetch.mockRejectedValueOnce({ statusCode: 500, message: "Server error" });

    await fetchChangelogs();
    expect(isLoading.value).toBe(false);
    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("Failed to load changelogs");
  });
});
