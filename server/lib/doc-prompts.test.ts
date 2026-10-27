import { describe, expect, it } from "vitest";
import {
  buildWikiOutlinePrompt,
  buildWikiPagePrompt,
  extractJsonObject,
  parseWikiOutlineJson,
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
      { slug: "1-overview", title: "Overview", group: "Core" },
      { slug: "2-api", title: "API", group: "Core" },
    ]);
  });
});

describe("wiki prompts", () => {
  it("requires unique outline slugs", () => {
    const prompt = buildWikiOutlinePrompt("ctx", "/repos", "App");
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

  it("outline prompt uses repo-dir prefixed sourceFiles example", () => {
    const prompt = buildWikiOutlinePrompt("ctx", "/repos", "App");
    expect(prompt).toContain('"<repo-dir>/README.md"');
    expect(prompt).toContain("each prefixed with the repository directory name");
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
