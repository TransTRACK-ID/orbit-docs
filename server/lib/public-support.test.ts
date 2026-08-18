import { describe, expect, it } from "vitest";
import {
  isPublicHelpApp,
  shouldIncludeDocSiteInCatalog,
} from "./public-support";

describe("isPublicHelpApp", () => {
  it("includes active apps only", () => {
    expect(isPublicHelpApp("active")).toBe(true);
    expect(isPublicHelpApp("draft")).toBe(false);
    expect(isPublicHelpApp("maintenance")).toBe(false);
  });
});

describe("shouldIncludeDocSiteInCatalog", () => {
  it("includes published public doc sites", () => {
    expect(shouldIncludeDocSiteInCatalog(false, "published", 0)).toBe(true);
  });

  it("includes draft sites with published pages", () => {
    expect(shouldIncludeDocSiteInCatalog(false, "draft", 2)).toBe(true);
  });

  it("excludes empty draft sites", () => {
    expect(shouldIncludeDocSiteInCatalog(false, "draft", 0)).toBe(false);
  });

  it("includes wiki sites with published pages", () => {
    expect(shouldIncludeDocSiteInCatalog(true, "draft", 1)).toBe(true);
  });
});
