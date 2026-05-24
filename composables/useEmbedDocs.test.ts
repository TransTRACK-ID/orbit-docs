import { describe, expect, it, vi, beforeEach } from "vitest";
import { useEmbedDocs } from "./useEmbedDocs";

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

describe("useEmbedDocs composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch embed docs", async () => {
    const data = {
      data: [
        { id: "e1", appId: "a1", versionId: null, title: "Embed One", slug: "embed-one", subtitle: null, navItems: null, content: "content", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { embedDocs, fetchEmbedDocs, isLoading } = useEmbedDocs();
    await fetchEmbedDocs();

    expect(embedDocs.value).toHaveLength(1);
    expect(embedDocs.value[0].title).toBe("Embed One");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single embed doc", async () => {
    const data = {
      data: { id: "e1", appId: "a1", versionId: null, title: "Embed One", slug: "embed-one", subtitle: null, navItems: null, content: "content", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { currentEmbedDoc, fetchEmbedDoc } = useEmbedDocs();
    const result = await fetchEmbedDoc("e1");

    expect(result.title).toBe("Embed One");
    expect(currentEmbedDoc.value?.id).toBe("e1");
  });

  it("should fetch public embed doc", async () => {
    const data = {
      data: { id: "e1", appId: "a1", versionId: null, title: "Embed One", slug: "embed-one", subtitle: null, navItems: null, content: "content", status: "published", author: null, createdAt: null, updatedAt: null, app: null, version: null },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { fetchPublicEmbedDoc } = useEmbedDocs();
    const result = await fetchPublicEmbedDoc("embed-one");

    expect(result.slug).toBe("embed-one");
  });

  it("should create an embed doc", async () => {
    const newDoc = { id: "e2", appId: "a1", versionId: null, title: "New Embed", slug: "new-embed", subtitle: null, navItems: null, content: "content", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null };
    mockFetch.mockResolvedValueOnce({ data: newDoc });

    const { embedDocs, createEmbedDoc } = useEmbedDocs();
    const result = await createEmbedDoc({ title: "New Embed", slug: "new-embed" });

    expect(result.title).toBe("New Embed");
    expect(embedDocs.value).toHaveLength(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Embed doc "New Embed" created');
  });

  it("should update an embed doc", async () => {
    const updated = { id: "e1", appId: "a1", versionId: null, title: "Updated", slug: "updated", subtitle: null, navItems: null, content: "updated", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { embedDocs, currentEmbedDoc, updateEmbedDoc, isSaving } = useEmbedDocs();
    embedDocs.value = [{ id: "e1", appId: "a1", versionId: null, title: "Old", slug: "old", subtitle: null, navItems: null, content: "old", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null }];
    currentEmbedDoc.value = { ...embedDocs.value[0], appVersions: [] };

    const result = await updateEmbedDoc("e1", { title: "Updated" });
    expect(result.title).toBe("Updated");
    expect(embedDocs.value[0].title).toBe("Updated");
    expect(isSaving.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Embed doc saved");
  });

  it("should delete an embed doc", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { embedDocs, currentEmbedDoc, deleteEmbedDoc } = useEmbedDocs();
    embedDocs.value = [{ id: "e1", appId: "a1", versionId: null, title: "Embed", slug: "embed", subtitle: null, navItems: null, content: "content", status: "draft", author: null, createdAt: null, updatedAt: null, app: null, version: null }];
    currentEmbedDoc.value = { ...embedDocs.value[0], appVersions: [] };

    await deleteEmbedDoc("e1");
    expect(embedDocs.value).toHaveLength(0);
    expect(currentEmbedDoc.value).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith("Embed doc deleted");
  });

  it("should handle 401 on fetchEmbedDocs", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchEmbedDocs } = useEmbedDocs();
    await fetchEmbedDocs();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });
});
