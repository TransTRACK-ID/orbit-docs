import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDocs } from "./useDocs";

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

describe("useDocs composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch docs", async () => {
    const data = {
      data: [
        { id: "d1", appId: "a1", title: "Doc One", content: "content", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(data);

    const { docs, fetchDocs, isLoading } = useDocs();
    await fetchDocs();

    expect(docs.value).toHaveLength(1);
    expect(docs.value[0].title).toBe("Doc One");
    expect(isLoading.value).toBe(false);
  });

  it("should fetch a single doc", async () => {
    const data = {
      data: { id: "d1", appId: "a1", title: "Doc One", content: "content", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { currentDoc, fetchDoc } = useDocs();
    const result = await fetchDoc("d1");

    expect(result.title).toBe("Doc One");
    expect(currentDoc.value?.id).toBe("d1");
  });

  it("should create a doc", async () => {
    const newDoc = { id: "d2", appId: "a1", title: "New Doc", content: "content", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null };
    mockFetch.mockResolvedValueOnce({ data: newDoc });

    const { docs, createDoc } = useDocs();
    const result = await createDoc({ title: "New Doc", appId: "a1", content: "content" });

    expect(result.title).toBe("New Doc");
    expect(docs.value).toHaveLength(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Doc "New Doc" created');
  });

  it("should update a doc silently without toast", async () => {
    const updated = { id: "d1", appId: "a1", title: "Updated Doc", content: "updated", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { updateDoc } = useDocs();
    await updateDoc("d1", { title: "Updated Doc" }, { silent: true });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("should update a doc", async () => {
    const updated = { id: "d1", appId: "a1", title: "Updated Doc", content: "updated", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { docs, currentDoc, updateDoc, isSaving } = useDocs();
    docs.value = [{ id: "d1", appId: "a1", title: "Old", content: "old", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null }];
    currentDoc.value = { ...docs.value[0], appVersions: [] };

    const result = await updateDoc("d1", { title: "Updated Doc" });
    expect(result.title).toBe("Updated Doc");
    expect(docs.value[0].title).toBe("Updated Doc");
    expect(isSaving.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft saved");
  });

  it("should publish a doc", async () => {
    const published = { id: "d1", appId: "a1", title: "Doc", content: "content", status: "published", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null, appVersions: [] };
    mockFetch.mockResolvedValueOnce({ data: published });

    const { docs, currentDoc, publishDoc } = useDocs();
    docs.value = [{ id: "d1", appId: "a1", title: "Doc", content: "content", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null }];
    currentDoc.value = { ...docs.value[0], appVersions: [] };

    const result = await publishDoc("d1");
    expect(result.status).toBe("published");
    expect(currentDoc.value?.status).toBe("published");
    expect(mockToastSuccess).toHaveBeenCalledWith("Published: Doc");
  });

  it("should delete a doc", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { docs, currentDoc, deleteDoc } = useDocs();
    docs.value = [{ id: "d1", appId: "a1", title: "Doc", content: "content", status: "draft", versionId: null, tags: null, author: null, createdAt: null, updatedAt: null, app: null, version: null }];
    currentDoc.value = { ...docs.value[0], appVersions: [] };

    await deleteDoc("d1");
    expect(docs.value).toHaveLength(0);
    expect(currentDoc.value).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith("Doc deleted");
  });
});
