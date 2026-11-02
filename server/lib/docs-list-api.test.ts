import { describe, expect, it } from "vitest";
import { buildDocsViewCondition, parseDocsListPagination } from "./docs-list-api";

describe("parseDocsListPagination", () => {
  it("defaults offset to 0 and excludes content", () => {
    expect(parseDocsListPagination({})).toEqual({
      limit: undefined,
      offset: 0,
      includeContent: false,
    });
  });

  it("parses limit and includeContent", () => {
    expect(parseDocsListPagination({ limit: "25", offset: "50", includeContent: "true" })).toEqual({
      limit: 25,
      offset: 50,
      includeContent: true,
    });
  });
});

describe("buildDocsViewCondition", () => {
  it("returns sql fragments for each view without throwing", () => {
    expect(buildDocsViewCondition("product", false)).toBeTruthy();
    expect(buildDocsViewCondition("knowledge", false)).toBeTruthy();
    expect(buildDocsViewCondition("adrs", true)).toBeTruthy();
    expect(buildDocsViewCondition("all", false)).toBeTruthy();
  });
});
