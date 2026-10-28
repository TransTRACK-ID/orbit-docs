import { describe, expect, it } from "vitest";
import {
  buildWikiOutlineExpansionPrompt,
  buildWikiOutlinePrompt,
  buildWikiPageExpansionPrompt,
  buildWikiPagePrompt,
  extractJsonObject,
  parseWikiOutlineJson,
  parseWikiOutlinePagesJson,
  prependAdrConstraints,
} from "./doc-prompts";

describe("prependAdrConstraints", () => {
  it("returns prompt unchanged when no constraints", () => {
    expect(prependAdrConstraints("base prompt", "")).toBe("base prompt");
  });

  it("prepends binding block before prompt", () => {
    const result = prependAdrConstraints("Write SRS", "BINDING ADRs:\n- ADR-001: Use JWT");
    expect(result).toContain("BINDING ARCHITECTURAL DECISIONS");
    expect(result).toContain("Write SRS");
    expect(result.indexOf("BINDING ARCHITECTURAL DECISIONS")).toBeLessThan(
      result.indexOf("Write SRS")
    );
  });

  it("adds update alignment note for update prompts", () => {
    const result = prependAdrConstraints("Update FSD", "BINDING ADRs:\n- ADR-001", {
      isUpdate: true,
    });
    expect(result).toContain("Deviations");
  });
});

describe("parseWikiOutlineJson", () => {
  const samplePlan = {
    siteName: "Adaptive Gateway",
    siteSlug: "adaptive-gateway",
    pages: [{ slug: "1-overview", title: "Overview" }],
  };

  it("parses bare JSON", () => {
    expect(parseWikiOutlineJson(JSON.stringify(samplePlan))).toEqual(samplePlan);
  });

  it("extracts JSON from markdown fences", () => {
    const raw = "```json\n" + JSON.stringify(samplePlan) + "\n```";
    expect(parseWikiOutlineJson(raw)).toEqual(samplePlan);
  });

  it("extracts JSON when the agent adds prose before the object", () => {
    const raw = `Analyzing repositories for wiki outline...\n\n${JSON.stringify(samplePlan)}`;
    expect(parseWikiOutlineJson(raw)).toEqual(samplePlan);
  });

  it("throws a helpful error when no JSON is present", () => {
    expect(() => parseWikiOutlineJson("Analyzing repositories for wiki outline...")).toThrow(
      /did not contain JSON/i
    );
  });

  it("keeps the first page when the same slug appears twice", () => {
    const raw = JSON.stringify({
      siteName: "Platform Integrator",
      siteSlug: "platform-integrator",
      pages: [
        { slug: "1-overview", title: "Overview", group: "Core" },
        { slug: "1-overview", title: "Overview", group: "Pages" },
        { slug: "2-api", title: "API", group: "Core" },
      ],
    });

    expect(parseWikiOutlineJson(raw).pages).toEqual([
      { slug: "1-overview", title: "Overview", groupPath: ["Core"] },
      { slug: "2-api", title: "API", groupPath: ["Core"] },
    ]);
  });

  it("caps groupPath at 3 levels and drops non-string labels", () => {
    const raw = JSON.stringify({
      siteName: "X",
      siteSlug: "x",
      pages: [
        { slug: "1-overview", title: "Overview", groupPath: ["A", 42, " B ", "", "C", "D"] },
      ],
    });
    expect(parseWikiOutlineJson(raw).pages[0].groupPath).toEqual(["A", "B", "C"]);
  });
});

describe("wiki prompts", () => {
  it("requires unique outline slugs", () => {
    const prompt = buildWikiOutlinePrompt("ctx", "/repos", "App", { min: 40, max: 60 });
    expect(prompt).toMatch(/slug must be unique/i);
  });

  it("forbids preamble and a second copy of the page", () => {
    const prompt = buildWikiPagePrompt(
      "{{INTRO}}",
      { slug: "1-overview", title: "Overview" },
      "app",
      [{ slug: "1-overview", title: "Overview" }],
      "ctx",
      "/repos",
      true,
    );
    expect(prompt).toMatch(/Do not add a second document or duplicate headings/);
    expect(prompt).toMatch(/Do not include analysis, planning, or thinking sentences/);
    expect(prompt).toMatch(/Do not repeat the page title as a markdown heading/);
  });

  it("page prompt contains the mermaid and-chain rule", () => {
    const prompt = buildWikiPagePrompt(
      "{{INTRO}}",
      { slug: "1-overview", title: "Overview" },
      "app",
      [{ slug: "1-overview", title: "Overview" }],
      "ctx",
      "/repos",
      true,
    );
    expect(prompt).toContain('never write the word "and" between node IDs');
  });

  it("outline prompt uses repo-dir prefixed sourceFiles example", () => {
    const prompt = buildWikiOutlinePrompt("ctx", "/repos", "App", { min: 40, max: 60 });
    expect(prompt).toContain('"<repo-dir>/README.md"');
    expect(prompt).toContain("each prefixed with the repository directory name");
  });

  it("outline prompt uses the size-scaled budget and no legacy cap", () => {
    const prompt = buildWikiOutlinePrompt("ctx", "/repos", "App", { min: 40, max: 60 });
    expect(prompt).toContain("between 40 and 60 pages");
    expect(prompt).not.toContain("4–12");
    expect(prompt).toContain('"groupPath": ["Core", "Architecture"]');
  });

  it("expansion parser skips seen slugs and returns [] on garbage", () => {
    const raw = JSON.stringify({
      pages: [
        { slug: "1-overview", title: "Overview", groupPath: ["Core"] },
        { slug: "5-extra", title: "Extra", groupPath: ["Core", "Deep"] },
      ],
    });
    expect(parseWikiOutlinePagesJson(raw, new Set(["1-overview"]))).toEqual([
      { slug: "5-extra", title: "Extra", groupPath: ["Core", "Deep"] },
    ]);
    expect(parseWikiOutlinePagesJson("not json at all", new Set())).toEqual([]);
    expect(parseWikiOutlinePagesJson("", new Set())).toEqual([]);
  });

  it("expansion prompt lists existing pages and demands at least missingCount more", () => {
    const prompt = buildWikiOutlineExpansionPrompt(
      "App",
      [{ slug: "1-overview", title: "Overview", groupPath: ["Core", "Arch"] }],
      5,
      2,
    );
    expect(prompt).toContain("- 1-overview — Overview (Core / Arch)");
    expect(prompt).toContain("at least 5 additional pages");
    expect(prompt).toContain("starting at 2");
  });

  it("page prompt contains depth rules and scoped siblings plus full site structure", () => {
    const pages = [
      { slug: "1-overview", title: "Overview" },
      { slug: "2-auth", title: "Auth", groupPath: ["Core", "Auth"] },
      { slug: "3-tokens", title: "Tokens", groupPath: ["Core", "Auth"] },
      { slug: "4-billing", title: "Billing", groupPath: ["Billing"] },
    ];
    const prompt = buildWikiPagePrompt("{{INTRO}}", pages[1], "app", pages, "ctx", "/repos", false);
    expect(prompt).toContain("900–1600 words");
    const siblingBlock = prompt.split("Sibling pages")[1].split("Relevant source files")[0];
    expect(siblingBlock).toContain("[Tokens](/wiki/app/3-tokens)");
    expect(siblingBlock).toContain("[Overview](/wiki/app/1-overview)");
    expect(siblingBlock).not.toContain("Billing");
    const structureBlock = prompt.split("Site structure")[1].split("Sibling pages")[0];
    expect(structureBlock).toContain("[Billing](/wiki/app/4-billing)");
    expect(structureBlock).toContain("Core › Auth › [Tokens]");
    expect(prompt).toContain("How it works");
  });

  it("page expansion prompt keeps headings instruction and depth rules", () => {
    const prompt = buildWikiPageExpansionPrompt(
      { slug: "2-auth", title: "Auth", sourceFiles: ["repo/src/auth.ts"] },
      "app",
      "## How it works\n\nshort",
    );
    expect(prompt).toContain("Keep every existing heading");
    expect(prompt).toContain("900–1600 words");
    expect(prompt).toContain("## How it works");
    expect(prompt).toContain("Output ONLY the complete expanded markdown document");
  });

  it("page prompt contains source citations block with repo dirs and backticked sources", () => {
    const prompt = buildWikiPagePrompt(
      "{{INTRO}}",
      { slug: "2-api", title: "API", sourceFiles: ["repo-a/src/main.ts"] },
      "app",
      [
        { slug: "1-overview", title: "Overview" },
        { slug: "2-api", title: "API" },
      ],
      "ctx",
      "/repos",
      false,
      { repoDirs: ["repo-a", "repo-b"], docLinks: "- [System Design](/docs/doc-1) — SDD" },
    );
    expect(prompt).toContain("Source citations (REQUIRED");
    expect(prompt).toContain("repo-a, repo-b");
    expect(prompt).toContain("- `repo-a/src/main.ts`");
    expect(prompt).toContain("Product documents (use these exact markdown links");
    expect(prompt).toContain("- [System Design](/docs/doc-1) — SDD");
  });

  it("page prompt omits product documents block when docLinks empty", () => {
    const prompt = buildWikiPagePrompt(
      "{{INTRO}}",
      { slug: "2-api", title: "API", sourceFiles: ["repo-a/src/main.ts"] },
      "app",
      [{ slug: "2-api", title: "API" }],
      "ctx",
      "/repos",
      false,
      { repoDirs: ["repo-a"], docLinks: "" },
    );
    expect(prompt).not.toContain("Product documents (use these exact markdown links");
    expect(prompt).toContain("Source citations (REQUIRED");
  });
});

describe("extractJsonObject", () => {
  it("returns the outermost balanced object", () => {
    const json = extractJsonObject('prefix {"siteName":"x","nested":{"a":1}} suffix');
    expect(JSON.parse(json)).toEqual({ siteName: "x", nested: { a: 1 } });
  });
});
