import { describe, expect, it } from "vitest";
import { normalizeRepoUrl, sanitizeGitRef } from "./git-provider";

describe("normalizeRepoUrl", () => {
  it("appends .git to HTTPS URLs without it", () => {
    expect(
      normalizeRepoUrl("https://repopo.transtrack.id/order-planning/order-planning-web")
    ).toBe("https://repopo.transtrack.id/order-planning/order-planning-web.git");
  });

  it("keeps existing .git suffix", () => {
    expect(
      normalizeRepoUrl("https://github.com/org/repo.git")
    ).toBe("https://github.com/org/repo.git");
  });

  it("normalizes SSH URLs", () => {
    expect(normalizeRepoUrl("git@gitlab.com:group/project")).toBe(
      "git@gitlab.com:group/project.git"
    );
    expect(normalizeRepoUrl("git@gitlab.com:group/project.git")).toBe(
      "git@gitlab.com:group/project.git"
    );
  });

  it("trims trailing slashes before adding .git", () => {
    expect(normalizeRepoUrl("https://gitlab.com/org/repo/")).toBe(
      "https://gitlab.com/org/repo.git"
    );
  });
});

describe("sanitizeGitRef", () => {
  it("trims whitespace and strips quotes", () => {
    expect(sanitizeGitRef('  "dev-ceisa"  ')).toBe("dev-ceisa");
  });

  it("preserves slashes in branch names", () => {
    expect(sanitizeGitRef("release/2.5.0")).toBe("release/2.5.0");
  });
});
