import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublicSiteCache, usePublicSite } from "./usePublicSite";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

describe("usePublicSite composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    resetPublicSiteCache();
  });

  it("caches page fetches and dedupes concurrent requests", async () => {
    const page = {
      id: "p1",
      title: "Intro",
      content: "# Hello",
      slug: "intro",
      frontmatter: null,
      author: null,
      updatedAt: null,
      site: { id: "s1", name: "Test", slug: "test", navConfig: null, app: null, pages: [] },
    };
    mockFetch.mockResolvedValueOnce({ data: page });

    const { fetchPage } = usePublicSite();
    const [a, b] = await Promise.all([
      fetchPage("test", "intro"),
      fetchPage("test", "intro"),
    ]);

    expect(a).toEqual(page);
    expect(b).toEqual(page);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("prefetches pages without duplicate network calls", async () => {
    const page = {
      id: "p1",
      title: "History",
      content: "# History",
      slug: "view-history-order",
      frontmatter: null,
      author: null,
      updatedAt: null,
      site: { id: "s1", name: "Test", slug: "test", navConfig: null, app: null, pages: [] },
    };
    mockFetch.mockResolvedValueOnce({ data: page });

    const { prefetchPage, getCachedPage, fetchPage } = usePublicSite();
    prefetchPage("test", "view-history-order");
    prefetchPage("test", "view-history-order");

    await vi.waitFor(() => {
      expect(getCachedPage("test", "view-history-order")).toEqual(page);
    });

    await fetchPage("test", "view-history-order");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
