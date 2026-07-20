import { describe, it, expect } from "vitest";
import {
  buildGroupedAppDocumentation,
  formatMcpDoc,
  getDocCategory,
  type McpDocRow,
} from "./mcp-doc-payload";

function makeRow(overrides: Partial<McpDocRow> & Pick<McpDocRow, "id" | "title">): McpDocRow {
  return {
    id: overrides.id,
    title: overrides.title,
    appId: overrides.appId ?? "app-1",
    content: overrides.content ?? null,
    status: overrides.status ?? "draft",
    versionId: overrides.versionId ?? null,
    tags: overrides.tags ?? null,
    author: overrides.author ?? null,
    source: overrides.source ?? "manual",
    docType: overrides.docType ?? null,
    externalId: overrides.externalId ?? null,
    createdAt: overrides.createdAt ?? null,
    updatedAt: overrides.updatedAt ?? null,
    appName: overrides.appName ?? "Order Planning",
    version: overrides.version ?? null,
  };
}

describe("getDocCategory", () => {
  it("classifies OP sync features as knowledge", () => {
    expect(
      getDocCategory({ source: "op_sync", docType: "feature" }),
    ).toBe("knowledge");
  });

  it("classifies generated SRS as product", () => {
    expect(
      getDocCategory({ source: "generated", docType: "srs" }),
    ).toBe("product");
  });
});

describe("formatMcpDoc", () => {
  it("adds display labels for generated product docs", () => {
    const formatted = formatMcpDoc(
      makeRow({
        id: "srs",
        title: "Software Requirements Specification (SRS)",
        source: "generated",
        docType: "srs",
      }),
    );

    expect(formatted.category).toBe("product");
    expect(formatted.displayLabel).toBe("SRS");
    expect(formatted.displaySubtitle).toBeNull();
  });

  it("omits content unless requested", () => {
    const formatted = formatMcpDoc(
      makeRow({ id: "1", title: "Guide", content: "secret" }),
    );
    expect(formatted).not.toHaveProperty("content");

    const withContent = formatMcpDoc(
      makeRow({ id: "1", title: "Guide", content: "secret" }),
      { includeContent: true },
    );
    expect(withContent).toHaveProperty("content", "secret");
  });
});

describe("buildGroupedAppDocumentation", () => {
  it("mirrors /docs product and knowledge sections", () => {
    const groups = buildGroupedAppDocumentation([
      makeRow({ id: "srs", title: "SRS", source: "generated", docType: "srs" }),
      makeRow({ id: "guide", title: "User Guide", source: "manual" }),
      makeRow({
        id: "f1",
        title: "List Unit",
        source: "op_sync",
        docType: "feature",
        externalId: "UNT-001",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sections).toHaveLength(2);
    expect(groups[0].sections[0].kind).toBe("product");
    expect(groups[0].sections[0].label).toBe("Product documentation");
    expect(groups[0].sections[0].docs).toHaveLength(2);
    expect(groups[0].sections[1].kind).toBe("knowledge");
    expect(groups[0].sections[1].label).toBe("Knowledge base");
    expect(groups[0].sections[1].docs).toHaveLength(1);
  });

  it("collapses large knowledge sections", () => {
    const featureRows = Array.from({ length: 10 }, (_, index) =>
      makeRow({
        id: `f-${index}`,
        title: `Feature ${index}`,
        source: "op_sync",
        docType: "feature",
        externalId: `F-${index}`,
      }),
    );

    const groups = buildGroupedAppDocumentation(featureRows, "knowledge");
    const section = groups[0].sections[0];

    expect(section.collapsed).toBe(true);
    expect(section.docs).toHaveLength(0);
    expect(section.summary).toContain("10 synced features");
  });
});
