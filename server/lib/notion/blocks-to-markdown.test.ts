import { describe, expect, it } from "vitest";
import { parseReleaseCategories } from "~/server/lib/notion/blocks-to-markdown";

describe("parseReleaseCategories", () => {
  it("extracts category bullets from markdown headings", () => {
    const md = `## Added
- New dashboard
- Export CSV

## Fixed
- Login redirect bug`;

    expect(parseReleaseCategories(md)).toEqual({
      added: ["New dashboard", "Export CSV"],
      fixed: ["Login redirect bug"],
      changed: [],
      deprecated: [],
      security: [],
    });
  });
});
