import { describe, expect, it } from "vitest";
import { buildRepoFileUrl, normalizeRepoUrl, sanitizeGitRef } from "./git-provider";

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

describe("buildRepoFileUrl", () => {
  it("builds GitHub HTTPS URL with line range anchor", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo.git",
        ref: "abc123",
        path: "src/main.ts",
        startLine: 10,
        endLine: 20,
      })
    ).toBe("https://github.com/org/repo/blob/abc123/src/main.ts#L10-L20");
  });

  it("builds GitHub web URL from SSH repo URL", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "git@github.com:org/repo.git",
        ref: "main",
        path: "src/main.ts",
      })
    ).toBe("https://github.com/org/repo/blob/main/src/main.ts");
  });

  it("uses single-line anchor", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        path: "src/main.ts",
        startLine: 10,
      })
    ).toBe("https://github.com/org/repo/blob/main/src/main.ts#L10");
  });

  it("omits anchor when no lines given", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        path: "README.md",
      })
    ).toBe("https://github.com/org/repo/blob/main/README.md");
  });

  it("builds GitLab URL for nested groups", () => {
    expect(
      buildRepoFileUrl({
        provider: "gitlab",
        repoUrl: "https://gitlab.com/group/sub/repo.git",
        ref: "main",
        path: "src/main.ts",
        startLine: 10,
        endLine: 20,
      })
    ).toBe("https://gitlab.com/group/sub/repo/-/blob/main/src/main.ts#L10-20");
  });

  it("uses self-hosted hostUrl with https and http schemes", () => {
    expect(
      buildRepoFileUrl({
        provider: "gitlab",
        repoUrl: "https://gitlab.example.com/org/repo",
        hostUrl: "https://gitlab.example.com",
        ref: "main",
        path: "a.ts",
      })
    ).toBe("https://gitlab.example.com/org/repo/-/blob/main/a.ts");
    expect(
      buildRepoFileUrl({
        provider: "gitlab",
        repoUrl: "http://git.internal/org/repo",
        hostUrl: "http://git.internal",
        ref: "main",
        path: "a.ts",
      })
    ).toBe("http://git.internal/org/repo/-/blob/main/a.ts");
  });

  it("encodes path segments", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        path: "pages/[id].client.vue",
      })
    ).toBe("https://github.com/org/repo/blob/main/pages/%5Bid%5D.client.vue");
  });

  it("treats gitlab host with github provider as GitLab", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://gitlab.example.com/org/repo",
        ref: "main",
        path: "a.ts",
        startLine: 3,
        endLine: 5,
      })
    ).toBe("https://gitlab.example.com/org/repo/-/blob/main/a.ts#L3-5");
  });

  it("returns null for unparseable URL or empty ref/path", () => {
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "not a url",
        ref: "main",
        path: "a.ts",
      })
    ).toBeNull();
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo",
        ref: " ",
        path: "a.ts",
      })
    ).toBeNull();
    expect(
      buildRepoFileUrl({
        provider: "github",
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        path: "",
      })
    ).toBeNull();
  });
});
