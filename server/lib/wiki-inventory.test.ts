import { describe, expect, it } from "vitest";
import {
  computeWikiPageBudget,
  formatWikiInventoryContext,
  summarizeWikiPaths,
} from "./wiki-inventory";

describe("summarizeWikiPaths module counting", () => {
  it("counts only modules with at least 3 files, with root/depth-1 keys", () => {
    const inv = summarizeWikiPaths([
      "a.ts",
      "b.ts",
      "c.ts", // root "." x3
      "src/one.ts",
      "src/two.ts", // src x2 only -> not counted yet
      "src/lib/a.ts",
      "src/lib/b.ts",
      "src/lib/c.ts", // src/lib x3
      "docs/x.md", // docs depth-1 x1
    ]);
    // "." (3) + "src/lib" (3) = 2; "src" has 2, "docs" has 1
    expect(inv.moduleCount).toBe(2);
    expect(inv.totalFiles).toBe(9);
    expect(inv.truncated).toBe(false);
  });

  it("sorts paths lexicographically", () => {
    const inv = summarizeWikiPaths(["b/z.ts", "a.ts", "b/a.ts"]);
    expect(inv.paths).toEqual(["a.ts", "b/a.ts", "b/z.ts"]);
  });

  it("caps at 2000 and flags truncation", () => {
    const many = Array.from({ length: 2001 }, (_, i) => `f${String(i).padStart(5, "0")}.ts`);
    const inv = summarizeWikiPaths(many);
    expect(inv.totalFiles).toBe(2001);
    expect(inv.paths).toHaveLength(2000);
    expect(inv.truncated).toBe(true);
  });
});

describe("computeWikiPageBudget tiers", () => {
  it("small repo tier", () => {
    expect(computeWikiPageBudget(199, 9)).toEqual({ min: 15, max: 25 });
    expect(computeWikiPageBudget(0, 0)).toEqual({ min: 15, max: 25 });
  });
  it("medium tier at 200 files", () => {
    expect(computeWikiPageBudget(200, 9)).toEqual({ min: 25, max: 40 });
    expect(computeWikiPageBudget(199, 10)).toEqual({ min: 25, max: 40 });
    expect(computeWikiPageBudget(999, 29)).toEqual({ min: 25, max: 40 });
  });
  it("large tier at 1000 files or 30 modules", () => {
    expect(computeWikiPageBudget(1000, 0)).toEqual({ min: 40, max: 60 });
    expect(computeWikiPageBudget(10, 30)).toEqual({ min: 40, max: 60 });
  });
});

describe("formatWikiInventoryContext", () => {
  const repos = [
    {
      name: "app",
      repoUrl: "https://example.com/app.git",
      dir: "/tmp/app",
      inventory: summarizeWikiPaths(["src/lib/a.ts", "src/lib/b.ts", "src/lib/c.ts", "README.md"]),
      readmeExcerpt: "Hello readme",
    },
  ];

  it("outline context contains grouped paths and readme", () => {
    const { outlineContext } = formatWikiInventoryContext(repos);
    expect(outlineContext).toContain("This product is composed of 1 repositories. Analyze ALL of them.");
    expect(outlineContext).toContain("src/lib/ (3 files)");
    expect(outlineContext).toContain("  - src/lib/a.ts");
    expect(outlineContext).toContain("README excerpt:\nHello readme");
  });

  it("outline context notes truncation", () => {
    const many = Array.from({ length: 2001 }, (_, i) => `f${String(i).padStart(5, "0")}.ts`);
    const { outlineContext } = formatWikiInventoryContext([
      { ...repos[0], inventory: summarizeWikiPaths(many), readmeExcerpt: "" },
    ]);
    expect(outlineContext).toContain("listing truncated to first 2000 paths");
  });

  it("page context contains module counts and no path lines", () => {
    const { pageContext } = formatWikiInventoryContext(repos);
    expect(pageContext).toContain("Modules:");
    expect(pageContext).toContain("src/lib (3)");
    expect(pageContext).not.toContain("- src/lib/a.ts");
    expect(pageContext).not.toMatch(/^\s+- /m);
  });
});
