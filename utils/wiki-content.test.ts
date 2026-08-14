import { describe, it, expect } from "vitest";
import {
  deriveWikiOnlySiteIds,
  isForbiddenWikiDocStatus,
  isWikiDoc,
  isWikiOnlySiteFromPages,
} from "./wiki-content";

describe("isWikiDoc", () => {
  it("detects wiki doc type", () => {
    expect(isWikiDoc({ docType: "wiki" })).toBe(true);
    expect(isWikiDoc({ docType: "srs" })).toBe(false);
  });
});

describe("isWikiOnlySiteFromPages", () => {
  it("returns true when all pages are wiki", () => {
    expect(
      isWikiOnlySiteFromPages([
        { docType: "wiki" },
        { docType: "wiki" },
      ]),
    ).toBe(true);
  });

  it("returns false for mixed or empty sites", () => {
    expect(isWikiOnlySiteFromPages([])).toBe(false);
    expect(
      isWikiOnlySiteFromPages([
        { docType: "wiki" },
        { docType: "srs" },
      ]),
    ).toBe(false);
  });
});

describe("deriveWikiOnlySiteIds", () => {
  it("marks sites with only wiki pages", () => {
    const ids = deriveWikiOnlySiteIds([
      { siteId: "s1", docType: "wiki" },
      { siteId: "s1", docType: "wiki" },
      { siteId: "s2", docType: "wiki" },
      { siteId: "s2", docType: "srs" },
    ]);
    expect(ids.has("s1")).toBe(true);
    expect(ids.has("s2")).toBe(false);
  });
});

describe("isForbiddenWikiDocStatus", () => {
  it("blocks public lifecycle statuses", () => {
    expect(isForbiddenWikiDocStatus("published")).toBe(true);
    expect(isForbiddenWikiDocStatus("draft")).toBe(false);
  });
});
