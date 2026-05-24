import { describe, expect, it, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useApps } from "./useApps";

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

describe("useApps composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch apps", async () => {
    const appsData = {
      data: [
        { id: "1", name: "App One", description: null, owner: null, status: "active", repoUrl: null, createdAt: null, updatedAt: null, latestVersion: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(appsData);

    const { apps, fetchApps, isLoading } = useApps();
    expect(isLoading.value).toBe(false);

    const promise = fetchApps();
    expect(isLoading.value).toBe(true);
    await promise;

    expect(apps.value).toHaveLength(1);
    expect(apps.value[0].name).toBe("App One");
    expect(isLoading.value).toBe(false);
  });

  it("should search apps with query", async () => {
    mockFetch.mockResolvedValueOnce({ data: [] });
    const { fetchApps, search } = useApps();
    search.value = "test";
    await fetchApps();
    expect(mockFetch).toHaveBeenCalledWith("/api/apps", {
      query: { search: "test" },
    });
  });

  it("should create an app", async () => {
    const newApp = { id: "2", name: "New App", description: null, owner: null, status: "active", repoUrl: null, createdAt: null, updatedAt: null };
    mockFetch
      .mockResolvedValueOnce({ data: newApp })
      .mockResolvedValueOnce({ data: { activeApps: 1, totalVersions: 0, publishedDocs: 0, draftVersions: 0 } })
      .mockResolvedValueOnce({ data: [] });

    const { apps, createApp, isCreating } = useApps();
    const result = await createApp({ name: "New App" });

    expect(result.name).toBe("New App");
    expect(apps.value).toHaveLength(1);
    expect(isCreating.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith('App "New App" created');
  });

  it("should update an app", async () => {
    const existing = { id: "1", name: "Old", description: null, owner: null, status: "active", repoUrl: null, createdAt: null, updatedAt: null, latestVersion: null };
    const updated = { id: "1", name: "Updated", description: "desc", owner: null, status: "active", repoUrl: null, createdAt: null, updatedAt: null };

    mockFetch
      .mockResolvedValueOnce({ data: updated })
      .mockResolvedValueOnce({ data: { activeApps: 1, totalVersions: 0, publishedDocs: 0, draftVersions: 0 } })
      .mockResolvedValueOnce({ data: [] });

    const { apps, updateApp } = useApps();
    apps.value = [existing];

    const result = await updateApp("1", { name: "Updated", description: "desc" });
    expect(result.name).toBe("Updated");
    expect(apps.value[0].name).toBe("Updated");
  });

  it("should delete an app", async () => {
    mockFetch
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ data: { activeApps: 0, totalVersions: 0, publishedDocs: 0, draftVersions: 0 } })
      .mockResolvedValueOnce({ data: [] });

    const { apps, deleteApp } = useApps();
    apps.value = [{ id: "1", name: "App", description: null, owner: null, status: "active", repoUrl: null, createdAt: null, updatedAt: null, latestVersion: null }];

    await deleteApp("1");
    expect(apps.value).toHaveLength(0);
    expect(mockToastSuccess).toHaveBeenCalledWith("App deleted");
  });

  it("should handle 401 on fetchApps", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchApps } = useApps();
    await fetchApps();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });

  it("should fetch app stats", async () => {
    const statsData = { data: { activeApps: 5, totalVersions: 10, publishedDocs: 3, draftVersions: 2 } };
    mockFetch.mockResolvedValueOnce(statsData);
    const { stats, fetchStats } = useApps();
    await fetchStats();
    expect(stats.value).toEqual(statsData.data);
  });

  it("should fetch activities", async () => {
    const activityData = { data: [{ id: "1", appId: "1", appName: "App", action: "created", actor: "user", createdAt: null }] };
    mockFetch.mockResolvedValueOnce(activityData);
    const { activities, fetchActivities } = useApps();
    await fetchActivities();
    expect(activities.value).toHaveLength(1);
  });
});
