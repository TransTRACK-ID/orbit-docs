import { describe, expect, it } from "vitest";
import {
  appPathSegment,
  buildDocPaths,
  buildGrepMatcher,
  extractOutline,
  findSectionRange,
  formatNumberedLines,
  grepContentLines,
  type DocPathInput,
} from "./doc-file-tools";

function pathRow(overrides: Partial<DocPathInput>): DocPathInput {
  return {
    id: "00000000-aaaa",
    title: "Doc",
    docType: "sdd",
    source: "generated",
    externalId: null,
    slug: null,
    siteSlug: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const SAMPLE = [
  "# Auth Service",
  "Intro line",
  "## Login",
  "Users log in with OAuth.",
  "### Errors",
  "invalid_grant when token expired",
  "```md",
  "## not a heading",
  "```",
  "## Logout",
  "Clears the session.",
].join("\n");

describe("buildDocPaths", () => {
  it("places product, knowledge, and wiki docs in virtual folders", () => {
    const paths = buildDocPaths("order-planning", [
      pathRow({ id: "a", title: "System Design" }),
      pathRow({ id: "b", title: "Live GPS", docType: "feature", source: "op_sync", externalId: "FEAT-12" }),
      pathRow({ id: "c", title: "Getting Started", docType: "wiki", slug: "getting-started", siteSlug: "op-wiki" }),
    ]);
    expect(paths.get("a")).toBe("/order-planning/product/sdd/system-design.md");
    expect(paths.get("b")).toBe("/order-planning/knowledge/feature/feat-12.md");
    expect(paths.get("c")).toBe("/order-planning/wiki/op-wiki/getting-started.md");
  });

  it("suffixes the newer doc on name collisions", () => {
    const paths = buildDocPaths("app", [
      pathRow({ id: "newer-doc-id", title: "Overview", createdAt: new Date("2026-02-01") }),
      pathRow({ id: "older-doc-id", title: "Overview", createdAt: new Date("2026-01-01") }),
    ]);
    expect(paths.get("older-doc-id")).toBe("/app/product/sdd/overview.md");
    expect(paths.get("newer-doc-id")).toBe("/app/product/sdd/overview-newer-do.md");
  });

  it("uses a workspace segment for docs without an app", () => {
    expect(appPathSegment({ id: null, name: null })).toBe("_workspace");
    expect(appPathSegment({ id: "x", name: "Order Planning" })).toBe("order-planning");
  });
});

describe("extractOutline / findSectionRange", () => {
  it("lists headings with line numbers and skips fenced code", () => {
    expect(extractOutline(SAMPLE).map((e) => `${e.line}:${e.level}:${e.text}`)).toEqual([
      "1:1:Auth Service",
      "3:2:Login",
      "5:3:Errors",
      "10:2:Logout",
    ]);
  });

  it("returns the section including nested subsections", () => {
    expect(findSectionRange(SAMPLE, "login")).toEqual({ startLine: 3, endLine: 9, heading: "Login" });
    expect(findSectionRange(SAMPLE, "## Logout")).toEqual({ startLine: 10, endLine: 11, heading: "Logout" });
    expect(findSectionRange(SAMPLE, "err")).toEqual({ startLine: 5, endLine: 9, heading: "Errors" });
    expect(findSectionRange(SAMPLE, "billing")).toBeNull();
  });
});

describe("grep helpers", () => {
  it("matches literal patterns case-insensitively with context", () => {
    const matches = grepContentLines(SAMPLE, buildGrepMatcher("OAUTH", { regex: false, caseSensitive: false }), {
      contextLines: 1,
      maxMatches: 10,
    });
    expect(matches).toEqual([
      {
        line: 4,
        text: "Users log in with OAuth.",
        contextBefore: ["## Login"],
        contextAfter: ["### Errors"],
      },
    ]);
  });

  it("escapes regex characters in literal mode and supports regex mode", () => {
    const literal = buildGrepMatcher("log in with OAuth.", { regex: false, caseSensitive: true });
    expect(literal.test("log in with OAuthX")).toBe(false);
    const regex = buildGrepMatcher("^## Log(in|out)$", { regex: true, caseSensitive: true });
    expect(grepContentLines(SAMPLE, regex, { contextLines: 0, maxMatches: 10 }).map((m) => m.line)).toEqual([3, 10]);
  });

  it("rejects empty or oversized patterns", () => {
    expect(() => buildGrepMatcher("", { regex: false, caseSensitive: false })).toThrow();
    expect(() => buildGrepMatcher("x".repeat(201), { regex: false, caseSensitive: false })).toThrow();
  });

  it("formats numbered lines with aligned widths", () => {
    expect(formatNumberedLines(["a", "b"], 9)).toBe(" 9| a\n10| b");
  });
});
