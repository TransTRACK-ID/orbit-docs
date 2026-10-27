import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/database", () => ({
  getDb: vi.fn(),
}));

vi.mock("~/server/lib/doc-embedding-hooks", () => ({
  onDocContentSaved: vi.fn(),
}));

import { staleWikiPageIds } from "./wiki-site-builder";
import type { ExistingWikiPageRow } from "./wiki-site-builder";

function row(overrides: Partial<ExistingWikiPageRow> = {}): ExistingWikiPageRow {
  return {
    id: "page-1",
    slug: "1-overview",
    docType: "wiki",
    source: "generated",
    status: "draft",
    ...overrides,
  };
}

describe("staleWikiPageIds", () => {
  it("returns a generated wiki page whose slug is not kept", () => {
    expect(staleWikiPageIds([row()], new Set(["2-architecture"]))).toEqual(["page-1"]);
  });

  it("keeps a page whose slug is in the new plan", () => {
    expect(staleWikiPageIds([row()], new Set(["1-overview"]))).toEqual([]);
  });

  it("keeps manually created site pages", () => {
    expect(staleWikiPageIds([row({ source: "manual" })], new Set())).toEqual([]);
  });

  it("keeps non-wiki docs", () => {
    expect(staleWikiPageIds([row({ docType: "sdd" })], new Set())).toEqual([]);
  });

  it("excludes already-archived pages", () => {
    expect(staleWikiPageIds([row({ status: "archived" })], new Set())).toEqual([]);
  });

  it("keeps rows without a slug", () => {
    expect(staleWikiPageIds([row({ slug: null })], new Set())).toEqual([]);
    expect(staleWikiPageIds([row({ slug: "" })], new Set())).toEqual([]);
  });

  it("returns an empty array when there are no existing pages", () => {
    expect(staleWikiPageIds([], new Set(["1-overview"]))).toEqual([]);
  });
});
