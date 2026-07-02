import { describe, expect, it } from "vitest";
import {
  buildGeneratedDocLinkMap,
  buildGeneratedDocLinkSources,
  resolveGeneratedDocTab,
} from "~/utils/generated-doc-links";

describe("generated-doc-links", () => {
  const sources = buildGeneratedDocLinkSources({
    availableTabs: ["srs", "fsd", "git_snapshot", "sdd", "sdd:repo-uuid"],
    repos: [{ id: "repo-uuid", repoName: "my-service" }],
  });
  const map = buildGeneratedDocLinkMap(sources);

  it("resolves standard product doc filenames", () => {
    expect(resolveGeneratedDocTab("./SRS.md", map)).toBe("srs");
    expect(resolveGeneratedDocTab("./FSD.md", map)).toBe("fsd");
    expect(resolveGeneratedDocTab("./GIT-SNAPSHOT.md", map)).toBe("git_snapshot");
    expect(resolveGeneratedDocTab("./SDD.md", map)).toBe("sdd");
  });

  it("resolves docs/ prefixed paths", () => {
    expect(resolveGeneratedDocTab("docs/SRS.md", map)).toBe("srs");
    expect(resolveGeneratedDocTab("./docs/FSD.md", map)).toBe("fsd");
  });

  it("resolves per-repo SDD filenames to repo tabs", () => {
    expect(resolveGeneratedDocTab("./SDD-my-service.md", map)).toBe("sdd:repo-uuid");
    expect(resolveGeneratedDocTab("./SDD-Backend.md", map)).toBe("sdd:repo-uuid");
    expect(resolveGeneratedDocTab("docs/SDD-Frontend.md", map)).toBe("sdd:repo-uuid");
  });

  it("ignores external links", () => {
    expect(resolveGeneratedDocTab("https://example.com/SRS.md", map)).toBeNull();
  });

  it("returns null for unknown files", () => {
    expect(resolveGeneratedDocTab("./README.md", map)).toBeNull();
  });
});
