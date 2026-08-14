import { describe, it, expect } from "vitest";
import { isWikiGenerationJob, wikiOverviewPathFromJob } from "./wiki-generation";

describe("wikiOverviewPathFromJob", () => {
  it("returns overview path from wiki job progress message", () => {
    expect(
      wikiOverviewPathFromJob({
        scope: "wiki",
        progressMessage: "Wiki site ready at /wiki/mytask-internal/1-overview",
      }),
    ).toBe("/wiki/mytask-internal/1-overview");
  });

  it("returns null for product jobs", () => {
    expect(
      wikiOverviewPathFromJob({
        scope: "product",
        progressMessage: "Wiki site ready at /wiki/foo/1-overview",
      }),
    ).toBeNull();
  });

  it("returns null when wiki job has no path in message", () => {
    expect(
      wikiOverviewPathFromJob({
        scope: "wiki",
        progressMessage: "Writing wiki pages…",
      }),
    ).toBeNull();
  });
});

describe("isWikiGenerationJob", () => {
  it("detects wiki scope", () => {
    expect(isWikiGenerationJob({ scope: "wiki", progressMessage: "" })).toBe(true);
    expect(isWikiGenerationJob({ scope: "product", progressMessage: "" })).toBe(false);
  });
});
