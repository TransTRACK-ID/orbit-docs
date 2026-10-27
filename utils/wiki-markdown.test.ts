import { describe, expect, it } from "vitest";
import { collapseRelevantSourceFiles, sanitizeWikiMarkdown } from "./wiki-markdown";
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

describe("collapseRelevantSourceFiles", () => {
  const heading = '<h2 id="relevant-source-files">Relevant source files</h2>';
  const linkA =
    '<a href="https://github.com/o/r/blob/x/a.ts#L1" target="_blank" rel="noopener noreferrer"><code>a.ts:1</code></a>';
  const linkB =
    '<a href="https://github.com/o/r/blob/x/b.ts#L2" target="_blank" rel="noopener noreferrer"><code>b.ts:2</code></a>';

  it("wraps the heading and list in a collapsed details with a file count", () => {
    const html = `${heading}\n<ul>\n<li>${linkA}</li>\n<li>${linkB}</li>\n</ul>\n`;
    const out = collapseRelevantSourceFiles(html);

    expect(out).toContain('<details class="wiki-source-files">');
    expect(out).not.toContain("<details open");
    expect(out).toContain(
      `<summary class="wiki-source-files-summary">${heading}<span class="wiki-source-files-count">2 files</span></summary>`,
    );
    expect(out).toContain(`<div class="wiki-source-files-body">\n<ul>\n<li>${linkA}</li>\n<li>${linkB}</li>\n</ul>\n</div></details>`);
  });

  it("wraps a section at the end of the document through EOF", () => {
    const html = `<p>Intro</p>\n${heading}\n<ul>\n<li>${linkA}</li>\n</ul>`;
    const out = collapseRelevantSourceFiles(html);

    expect(out.startsWith("<p>Intro</p>\n<details")).toBe(true);
    expect(out.endsWith("</ul></div></details>")).toBe(true);
  });

  it("keeps the following section outside the details element", () => {
    const html = `${heading}\n<ul>\n<li>${linkA}</li>\n</ul>\n<h2 id="details">Details</h2>\n<p>text</p>`;
    const out = collapseRelevantSourceFiles(html);

    const detailsEnd = out.indexOf("</details>");
    const detailsHeading = out.indexOf('<h2 id="details">');
    expect(detailsEnd).toBeGreaterThan(-1);
    expect(detailsHeading).toBeGreaterThan(detailsEnd);
  });

  it("uses the singular form for exactly one file", () => {
    const html = `${heading}\n<ul>\n<li>${linkA}</li>\n</ul>\n`;
    expect(collapseRelevantSourceFiles(html)).toContain(">1 file</span>");
  });

  it("returns the input unchanged when there is no matching heading", () => {
    const html = '<h2 id="details">Details</h2>\n<p>text</p>';
    expect(collapseRelevantSourceFiles(html)).toBe(html);
  });

  it("wraps two source-files sections without nesting them", () => {
    const html = `${heading}\n<ul>\n<li>${linkA}</li>\n</ul>\n<h2 id="details">Details</h2>\n<p>mid</p>\n${heading}\n<ul>\n<li>${linkB}</li>\n</ul>\n`;
    const out = collapseRelevantSourceFiles(html);

    expect(out.match(/<details class="wiki-source-files">/g)).toHaveLength(2);
    expect(out.match(/<\/details>/g)).toHaveLength(2);
    const firstClose = out.indexOf("</details>");
    const secondOpen = out.indexOf('<details class="wiki-source-files">', firstClose);
    expect(secondOpen).toBeGreaterThan(firstClose);
    expect(out).toContain('<h2 id="details">Details</h2>');
  });
});
