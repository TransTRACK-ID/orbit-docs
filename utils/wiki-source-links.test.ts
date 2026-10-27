import { describe, expect, it } from "vitest";
import {
  linkifyWikiSourceCitations,
  parseWikiSourceCitation,
  pruneInvalidWikiLinks,
  type WikiSourceCitation,
} from "./wiki-source-links";

function resolver(c: WikiSourceCitation) {
  return {
    url: `https://git.example.com/${c.path}${c.startLine ? `#L${c.startLine}` : ""}`,
    label: c.path + (c.startLine ? `:${c.startLine}${c.endLine ? `-${c.endLine}` : ""}` : ""),
  };
}

describe("parseWikiSourceCitation", () => {
  it("parses qualified path with line range", () => {
    expect(parseWikiSourceCitation("rally-server/features/x.go:10-40")).toEqual({
      raw: "rally-server/features/x.go:10-40",
      path: "rally-server/features/x.go",
      startLine: 10,
      endLine: 40,
    });
  });

  it("parses bare path with single line", () => {
    expect(parseWikiSourceCitation("src/main.ts:7")).toEqual({
      raw: "src/main.ts:7",
      path: "src/main.ts",
      startLine: 7,
    });
  });

  it("parses #L forms", () => {
    expect(parseWikiSourceCitation("src/main.ts#L12")).toEqual({
      raw: "src/main.ts#L12",
      path: "src/main.ts",
      startLine: 12,
    });
    expect(parseWikiSourceCitation("src/main.ts#L12-L20")).toEqual({
      raw: "src/main.ts#L12-L20",
      path: "src/main.ts",
      startLine: 12,
      endLine: 20,
    });
    expect(parseWikiSourceCitation("src/main.ts#L12-20")).toEqual({
      raw: "src/main.ts#L12-20",
      path: "src/main.ts",
      startLine: 12,
      endLine: 20,
    });
  });

  it("parses path without lines", () => {
    expect(parseWikiSourceCitation("repo/README.md")).toEqual({
      raw: "repo/README.md",
      path: "repo/README.md",
    });
  });

  it.each([
    "state:machine",
    "key:value",
    "https://github.com/org/repo/blob/main/a.ts",
    "http:example",
    "src/*.ts",
    "../secret.ts",
    "src/../secret.ts",
    "/abs/path.ts",
    "#anchor",
    "mailto:a@b.ts",
    "noextension",
    "file.",
    "a b.ts",
    "`src/a.ts`",
    "src/a.ts:1:2",
  ])("rejects %s", (token) => {
    expect(parseWikiSourceCitation(token)).toBeNull();
  });
});

describe("linkifyWikiSourceCitations", () => {
  it("links code span in Relevant source files bullet", () => {
    const md = "## Relevant source files\n\n- `rally-server/features/x.go:10-40` — validation";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.linked).toBe(1);
    expect(result.content).toContain(
      "- [`rally-server/features/x.go:10-40`](https://git.example.com/rally-server/features/x.go#L10) — validation"
    );
    expect(result.unresolved).toEqual([]);
  });

  it("links bullet-leading plain token preserving trailing description", () => {
    const md = "- src/main.ts:2-3 — entry point";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.linked).toBe(1);
    expect(result.content).toBe(
      "- [`src/main.ts:2-3`](https://git.example.com/src/main.ts#L2) — entry point"
    );
  });

  it("links inline code span in prose", () => {
    const md = "See `src/main.ts:5` for details.";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.content).toBe(
      "See [`src/main.ts:5`](https://git.example.com/src/main.ts#L5) for details."
    );
  });

  it("leaves fenced code blocks untouched", () => {
    const md = "```ts\n`src/main.ts:5`\n- src/main.ts:5\n```";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.content).toBe(md);
    expect(result.linked).toBe(0);
  });

  it("leaves existing markdown links untouched incl. code span in label", () => {
    const md = "[`src/main.ts:5`](https://example.com/a) and ![img `src/b.ts:1`](x.png)";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.content).toBe(md);
    expect(result.linked).toBe(0);
  });

  it("leaves unresolved tokens and records them", () => {
    const md = "- `missing/file.ts:1` — gone";
    const result = linkifyWikiSourceCitations(md, () => null);
    expect(result.content).toBe(md);
    expect(result.linked).toBe(0);
    expect(result.unresolved).toEqual(["missing/file.ts:1"]);
  });

  it("ignores non-citation code spans silently", () => {
    const md = "Use `state:machine` here.";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.content).toBe(md);
    expect(result.unresolved).toEqual([]);
  });

  it("links table-cell code span", () => {
    const md = "| File | Role |\n| --- | --- |\n| `src/main.ts:1-2` | entry |";
    const result = linkifyWikiSourceCitations(md, resolver);
    expect(result.linked).toBe(1);
    expect(result.content).toContain(
      "[`src/main.ts:1-2`](https://git.example.com/src/main.ts#L1)"
    );
  });
});

describe("pruneInvalidWikiLinks", () => {
  it("keeps valid slug, de-links unknown slug, leaves other links untouched", () => {
    const md =
      "[Good](/wiki/site/good-page) [Bad](/wiki/site/nope) [Other](/wiki/other/nope) [Doc](/docs/123)";
    expect(pruneInvalidWikiLinks(md, "site", new Set(["good-page"]))).toBe(
      "[Good](/wiki/site/good-page) Bad [Other](/wiki/other/nope) [Doc](/docs/123)"
    );
  });
});
