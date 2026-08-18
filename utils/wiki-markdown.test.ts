import { describe, expect, it } from "vitest";
import { sanitizeWikiMarkdown } from "./wiki-markdown";
import { buildOutlineFromMarkdown } from "~/composables/useDocOutline";

describe("sanitizeWikiMarkdown", () => {
  it("strips preamble, stuttered intro, and a second Overview heading", () => {
    const raw = [
      "# Overview",
      "",
      "Analyzing the three repositories and key docs to draft the overview wiki page. Analyzing the three repositories and key docs to draft the overview wiki page.",
      "",
      "## Overview",
      "",
      "The Platform Integrator is a fleet management platform.",
      "",
      "## Relevant source files",
      "",
      "- README.md",
      "",
      "## Architecture",
      "",
      "Diagram",
      "",
      "## Subsystems",
      "",
      "- API",
      "",
      "## Next steps",
      "",
      "Read the API page",
    ].join("\n");

    const cleaned = sanitizeWikiMarkdown(raw, "Overview");

    expect(cleaned).toBe(
      [
        "The Platform Integrator is a fleet management platform.",
        "",
        "## Relevant source files",
        "",
        "- README.md",
        "",
        "## Architecture",
        "",
        "Diagram",
        "",
        "## Subsystems",
        "",
        "- API",
        "",
        "## Next steps",
        "",
        "Read the API page",
      ].join("\n"),
    );

    const outline = buildOutlineFromMarkdown(cleaned).map((item) => item.text);
    expect(outline).toEqual([
      "Relevant source files",
      "Architecture",
      "Subsystems",
      "Next steps",
    ]);
  });

  it("keeps the last copy when the full heading tree is duplicated", () => {
    const copy = [
      "## Relevant source files",
      "",
      "- a.ts",
      "",
      "## Architecture",
      "",
      "First architecture",
      "",
      "## Subsystems",
      "",
      "- API",
      "",
      "## Next steps",
      "",
      "Done",
    ].join("\n");

    const raw = `# Overview\n\nDraft\n\n${copy}\n\n# Overview\n\n${copy.replace("First architecture", "Final architecture")}`;
    const cleaned = sanitizeWikiMarkdown(raw, "Overview");

    expect(cleaned).toContain("Final architecture");
    expect(cleaned).not.toContain("First architecture");
    expect(cleaned).not.toContain("# Overview");
    expect(buildOutlineFromMarkdown(cleaned).map((item) => item.text)).toEqual([
      "Relevant source files",
      "Architecture",
      "Subsystems",
      "Next steps",
    ]);
  });

  it("unwraps a markdown fence and strips a title-matching H1", () => {
    const raw = "```markdown\n# API\n\nThe REST layer.\n\n## Details\n\nHandlers\n```";
    expect(sanitizeWikiMarkdown(raw, "API")).toBe("The REST layer.\n\n## Details\n\nHandlers");
  });

  it("leaves a page without a title-matching heading unchanged aside from trim", () => {
    const raw = "## Details\n\nBody";
    expect(sanitizeWikiMarkdown(raw, "Auth")).toBe(raw);
  });
});
