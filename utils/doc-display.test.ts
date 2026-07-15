import { describe, it, expect } from "vitest";
import {
  groupDocsForList,
  isFeatureCatalogDoc,
  filterDocsByView,
  shouldCollapseKnowledgeSection,
} from "./doc-display";
import type { DocItem } from "~/composables/useDocs";

function makeDoc(overrides: Partial<DocItem> & Pick<DocItem, "id" | "title">): DocItem {
  return {
    id: overrides.id,
    title: overrides.title,
    appId: overrides.appId ?? "app-1",
    content: null,
    status: "draft",
    versionId: null,
    tags: overrides.tags ?? null,
    author: null,
    source: overrides.source ?? "manual",
    docType: overrides.docType ?? null,
    externalId: overrides.externalId ?? null,
    createdAt: null,
    updatedAt: null,
    app: overrides.app ?? { id: "app-1", name: "Order Planning" },
    version: null,
  };
}

describe("isFeatureCatalogDoc", () => {
  it("detects OP sync feature docs", () => {
    const doc = makeDoc({
      id: "1",
      title: "List Unit",
      source: "op_sync",
      docType: "feature",
    });
    expect(isFeatureCatalogDoc(doc)).toBe(true);
  });
});

describe("groupDocsForList", () => {
  const productDocs = [
    makeDoc({ id: "srs", title: "SRS", source: "generated", docType: "srs" }),
    makeDoc({ id: "fsd", title: "FSD", source: "generated", docType: "fsd" }),
  ];
  const knowledgeDocs = [
    makeDoc({
      id: "f1",
      title: "List Unit",
      source: "op_sync",
      docType: "feature",
      externalId: "UNT-001",
    }),
    makeDoc({
      id: "f2",
      title: "Update Unit",
      source: "op_sync",
      docType: "feature",
      externalId: "UNT-003",
    }),
  ];

  it("splits product and knowledge docs into sections", () => {
    const groups = groupDocsForList([...productDocs, ...knowledgeDocs]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sections).toHaveLength(2);
    expect(groups[0].sections[0].kind).toBe("product");
    expect(groups[0].sections[0].docs).toHaveLength(2);
    expect(groups[0].sections[1].kind).toBe("knowledge");
    expect(groups[0].sections[1].docs).toHaveLength(2);
    expect(groups[0].sections[0].label).toBe("Product documentation");
    expect(groups[0].sections[1].label).toBe("Knowledge base");
  });

  it("omits subsection labels when only one doc family exists", () => {
    const groups = groupDocsForList(knowledgeDocs);
    expect(groups[0].sections).toHaveLength(1);
    expect(groups[0].sections[0].label).toBe("");
  });

  it("filters by view", () => {
    const productOnly = groupDocsForList([...productDocs, ...knowledgeDocs], "product");
    expect(productOnly[0].sections).toHaveLength(1);
    expect(productOnly[0].sections[0].kind).toBe("product");

    const knowledgeOnly = groupDocsForList([...productDocs, ...knowledgeDocs], "knowledge");
    expect(knowledgeOnly[0].sections).toHaveLength(1);
    expect(knowledgeOnly[0].sections[0].kind).toBe("knowledge");
  });
});

describe("filterDocsByView", () => {
  it("returns only knowledge docs", () => {
    const docs = [
      makeDoc({ id: "1", title: "SRS", source: "generated", docType: "srs" }),
      makeDoc({ id: "2", title: "Feature", source: "op_sync", docType: "feature" }),
    ];
    expect(filterDocsByView(docs, "knowledge")).toHaveLength(1);
  });
});

describe("shouldCollapseKnowledgeSection", () => {
  it("collapses large knowledge sections", () => {
    const section = {
      kind: "knowledge" as const,
      label: "Knowledge base",
      docs: Array.from({ length: 9 }, (_, i) =>
        makeDoc({ id: String(i), title: `Feature ${i}`, source: "op_sync", docType: "feature" }),
      ),
    };
    expect(shouldCollapseKnowledgeSection(section)).toBe(true);
  });
});
