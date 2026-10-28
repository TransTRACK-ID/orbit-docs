import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/database", () => ({
  getDb: vi.fn(),
}));

vi.mock("~/server/lib/doc-embedding-hooks", () => ({
  onDocContentSaved: vi.fn(),
}));

import {
  staleWikiPageIds,
  pickCanonicalWikiSite,
  firstFreeWikiSlug,
} from "./wiki-site-builder";
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

describe("pickCanonicalWikiSite", () => {
  const site = (overrides: { id: string; createdAt: Date | null; updatedAt: Date | null }) => overrides;

  it("returns null for an empty list", () => {
    expect(pickCanonicalWikiSite([])).toBeNull();
  });

  it("returns the single row", () => {
    const only = site({ id: "a", createdAt: new Date("2024-01-01"), updatedAt: null });
    expect(pickCanonicalWikiSite([only])).toBe(only);
  });

  it("orders by updatedAt descending", () => {
    const older = site({ id: "a", createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-02-01") });
    const newer = site({ id: "b", createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-03-01") });
    expect(pickCanonicalWikiSite([older, newer])).toBe(newer);
    expect(pickCanonicalWikiSite([newer, older])).toBe(newer);
  });

  it("falls back to createdAt when updatedAt is null", () => {
    const withUpdated = site({ id: "a", createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-02-01") });
    const nullUpdated = site({ id: "b", createdAt: new Date("2024-03-01"), updatedAt: null });
    expect(pickCanonicalWikiSite([withUpdated, nullUpdated])).toBe(nullUpdated);
  });

  it("breaks a full tie by larger id", () => {
    const ts = new Date("2024-01-01");
    const a = site({ id: "a", createdAt: ts, updatedAt: ts });
    const b = site({ id: "b", createdAt: ts, updatedAt: ts });
    expect(pickCanonicalWikiSite([a, b])).toBe(b);
    expect(pickCanonicalWikiSite([b, a])).toBe(b);
  });
});

describe("firstFreeWikiSlug", () => {
  it("returns base when free", () => {
    expect(firstFreeWikiSlug("my-app", new Set())).toBe("my-app");
  });

  it("returns base-wiki when base is taken", () => {
    expect(firstFreeWikiSlug("my-app", new Set(["my-app"]))).toBe("my-app-wiki");
  });

  it("returns base-2 when base and base-wiki are taken", () => {
    expect(firstFreeWikiSlug("my-app", new Set(["my-app", "my-app-wiki"]))).toBe("my-app-2");
  });

  it("returns null when all 10 candidates are taken", () => {
    const taken = new Set([
      "my-app",
      "my-app-wiki",
      ...Array.from({ length: 8 }, (_, i) => `my-app-${i + 2}`),
    ]);
    expect(firstFreeWikiSlug("my-app", taken)).toBeNull();
  });
});
