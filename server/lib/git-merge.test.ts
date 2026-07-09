import { describe, expect, it } from "vitest";
import {
  isGithubPrConflicted,
  isGitlabMrConflicted,
  parseGithubPullNumber,
  parseGitlabMergeRequestIid,
} from "./git-merge";

describe("parseGithubPullNumber", () => {
  it("parses standard GitHub PR URLs", () => {
    expect(parseGithubPullNumber("https://github.com/org/repo/pull/42")).toBe(42);
    expect(parseGithubPullNumber("https://github.com/org/repo/pull/42/files")).toBe(42);
  });

  it("returns null for invalid URLs", () => {
    expect(parseGithubPullNumber("https://gitlab.com/org/repo/-/merge_requests/1")).toBeNull();
  });
});

describe("parseGitlabMergeRequestIid", () => {
  it("parses GitLab MR URLs", () => {
    expect(parseGitlabMergeRequestIid("https://gitlab.com/org/repo/-/merge_requests/7")).toBe(7);
  });
});

describe("isGithubPrConflicted", () => {
  it("detects explicit conflicts", () => {
    expect(isGithubPrConflicted(false, "dirty")).toBe(true);
    expect(isGithubPrConflicted(false, "clean")).toBe(true);
    expect(isGithubPrConflicted(true, "dirty")).toBe(true);
  });

  it("allows mergeable PRs", () => {
    expect(isGithubPrConflicted(true, "clean")).toBe(false);
    expect(isGithubPrConflicted(null, "unknown")).toBe(false);
  });
});

describe("isGitlabMrConflicted", () => {
  it("detects conflict status", () => {
    expect(isGitlabMrConflicted("conflict", "cannot_be_merged")).toBe(true);
    expect(isGitlabMrConflicted("conflict", "can_be_merged")).toBe(true);
    expect(isGitlabMrConflicted("", "cannot_be_merged")).toBe(true);
  });

  it("allows mergeable MRs", () => {
    expect(isGitlabMrConflicted("mergeable", "can_be_merged")).toBe(false);
    expect(isGitlabMrConflicted("ci_must_pass", "can_be_merged")).toBe(false);
  });
});
