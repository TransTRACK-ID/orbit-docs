import { describe, expect, it, vi } from "vitest";
import { useDocsPageList, type AppDocLoadState } from "./useDocsPageList";
import type { DocItem } from "./useDocs";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

function makeDoc(
  id: string,
  app: { id: string; name: string },
  title = `Doc ${id}`,
): DocItem {
  return {
    id,
    appId: app.id,
    title,
    content: null,
    status: "published",
    versionId: null,
    tags: null,
    author: null,
    source: "manual",
    docType: null,
    externalId: null,
    createdAt: null,
    updatedAt: null,
    app,
    version: null,
  };
}

function loaded(docs: DocItem[]): AppDocLoadState {
  return {
    docs,
    total: docs.length,
    offset: docs.length,
    loading: false,
    loadingMore: false,
    loaded: true,
    error: false,
  };
}

const apps = [
  { id: "app-1", name: "App One" },
  { id: "app-2", name: "App Two" },
];

describe("buildAccordionGroups app filter", () => {
  it("only shows the selected app (like /versions)", () => {
    const { appLoads, buildAccordionGroups } = useDocsPageList();
    appLoads.value = new Map([
      ["app-1", loaded([makeDoc("d1", apps[0]!)])],
      ["app-2", loaded([makeDoc("d2", apps[1]!)])],
    ]);

    const groups = buildAccordionGroups(apps, "product", false, "app-1");

    expect(groups.map((g) => g.key)).toEqual(["app-1"]);
    expect(groups[0]!.sections[0]!.docs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("drops the selected app once loaded with no visible docs (empty state)", () => {
    const { appLoads, buildAccordionGroups } = useDocsPageList();
    appLoads.value = new Map([["app-1", loaded([])]]);

    expect(buildAccordionGroups(apps, "product", false, "app-1")).toEqual([]);
  });

  it("keeps the placeholder while the first page is still loading", () => {
    const { appLoads, buildAccordionGroups } = useDocsPageList();
    appLoads.value = new Map([
      ["app-1", { ...loaded([]), loaded: false, loading: true }],
    ]);

    const groups = buildAccordionGroups(apps, "product", false, "app-1");

    expect(groups.map((g) => g.key)).toEqual(["app-1"]);
  });

  it("still shows all apps when no app filter is set", () => {
    const { appLoads, buildAccordionGroups } = useDocsPageList();
    appLoads.value = new Map([
      ["app-1", loaded([makeDoc("d1", apps[0]!)])],
      ["app-2", loaded([makeDoc("d2", apps[1]!)])],
    ]);

    const groups = buildAccordionGroups(apps, "product", false, "");

    expect(groups.map((g) => g.key)).toEqual(["app-1", "app-2"]);
  });
});
