import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDocSites } from "./useDocSites";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue3-toastify", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

describe("useDocSites composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch doc sites", async () => {
    const data = {
      data: [
        { id: "s1", appId: null, name: "Site One", slug: "site-one", description: null, status: "draft", navConfig: {}, createdAt: null, updatedAt: null, app: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { docSites, fetchDocSites, isLoading } = useDocSites();
    await fetchDocSites();

    expect(docSites.value).toHaveLength(1);
    expect(docSites.value[0].slug).toBe("site-one");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single doc site with pages", async () => {
    const data = {
      data: {
        id: "s1",
        appId: null,
        name: "Site One",
        slug: "site-one",
        description: null,
        status: "published",
        navConfig: { pages: ["intro"] },
        createdAt: null,
        updatedAt: null,
        app: null,
        pages: [{ id: "d1", title: "Intro", slug: "intro", status: "published", sortOrder: 0, updatedAt: null }],
      },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { currentSite, sitePages, fetchDocSite } = useDocSites();
    const result = await fetchDocSite("s1");

    expect(result.slug).toBe("site-one");
    expect(currentSite.value?.id).toBe("s1");
    expect(sitePages.value).toHaveLength(1);
  });

  it("should create a doc site", async () => {
    const created = { id: "s2", appId: null, name: "New Site", slug: "new-site", description: null, status: "draft", navConfig: {}, createdAt: null, updatedAt: null, app: null };
    mockFetch.mockResolvedValueOnce({ data: created });

    const { docSites, createDocSite } = useDocSites();
    const result = await createDocSite({ name: "New Site" });

    expect(result.slug).toBe("new-site");
    expect(docSites.value).toHaveLength(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Doc site "New Site" created');
  });

  it("should update a doc site", async () => {
    const updated = { id: "s1", appId: null, name: "Renamed", slug: "site-one", description: null, status: "published", navConfig: { pages: ["intro"] }, createdAt: null, updatedAt: null, app: null };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { docSites, currentSite, updateDocSite } = useDocSites();
    docSites.value = [{ id: "s1", appId: null, name: "Site One", slug: "site-one", description: null, status: "draft", navConfig: {}, createdAt: null, updatedAt: null, app: null }];
    currentSite.value = { ...docSites.value[0], pages: [] };

    const result = await updateDocSite("s1", { name: "Renamed", status: "published" });
    expect(result.name).toBe("Renamed");
    expect(docSites.value[0].name).toBe("Renamed");
    expect(currentSite.value?.status).toBe("published");
    expect(mockToastSuccess).toHaveBeenCalledWith("Doc site saved");
  });

  it("should delete a doc site", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { docSites, currentSite, deleteDocSite } = useDocSites();
    docSites.value = [{ id: "s1", appId: null, name: "Site One", slug: "site-one", description: null, status: "draft", navConfig: {}, createdAt: null, updatedAt: null, app: null }];
    currentSite.value = { ...docSites.value[0], pages: [] };

    await deleteDocSite("s1");
    expect(docSites.value).toHaveLength(0);
    expect(currentSite.value).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith("Doc site deleted");
  });

  it("should fetch site pages", async () => {
    mockFetch.mockResolvedValueOnce({
      data: [{ id: "d1", title: "Intro", slug: "intro", status: "published", sortOrder: 0, updatedAt: null }],
    });

    const { sitePages, fetchSitePages } = useDocSites();
    await fetchSitePages("s1");
    expect(sitePages.value).toHaveLength(1);
    expect(sitePages.value[0].slug).toBe("intro");
  });
});
