import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createWikiSourceCitationResolver, type WikiRepoLinkContext } from "./wiki-source-linker";
import { parseWikiSourceCitation } from "~/utils/wiki-source-links";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

let baseDir: string;
let repoA: string;
let repoB: string;
let contexts: WikiRepoLinkContext[];

function cite(token: string) {
  const parsed = parseWikiSourceCitation(token);
  if (!parsed) throw new Error(`test token should parse: ${token}`);
  return parsed;
}

beforeAll(() => {
  baseDir = mkdtempSync(join(tmpdir(), "wiki-source-linker-"));
  repoA = join(baseDir, "repo-a");
  repoB = join(baseDir, "repo-b");
  mkdirSync(join(repoA, "src"), { recursive: true });
  mkdirSync(join(repoB, "src"), { recursive: true });

  // 3 lines, trailing newline
  writeFileSync(join(repoA, "src", "shared.ts"), "one\ntwo\nthree\n");
  writeFileSync(join(repoB, "src", "shared.ts"), "one\n");
  writeFileSync(join(repoB, "only-b.ts"), "hello\nworld\n");
  writeFileSync(join(repoA, "bin.dat"), Buffer.from([0x41, 0x00, 0x42, 0x0a]));

  contexts = [
    {
      dirName: "repo-a",
      cloneDir: repoA,
      repo: { provider: "github", repoUrl: "https://github.com/org/repo-a.git", hostUrl: null },
      ref: SHA_A,
    },
    {
      dirName: "repo-b",
      cloneDir: repoB,
      repo: { provider: "gitlab", repoUrl: "https://gitlab.com/org/repo-b.git", hostUrl: null },
      ref: SHA_B,
    },
  ];
});

afterAll(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe("createWikiSourceCitationResolver", () => {
  it("resolves qualified path to right repo with pinned ref and clamped range", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("repo-a/src/shared.ts:2-99"))).toEqual({
      url: `https://github.com/org/repo-a/blob/${SHA_A}/src/shared.ts#L2-L3`,
      label: "src/shared.ts:2-3",
    });
  });

  it("resolves bare path unique to one repo", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("only-b.ts:1-2"))).toEqual({
      url: `https://gitlab.com/org/repo-b/-/blob/${SHA_B}/only-b.ts#L1-2`,
      label: "only-b.ts:1-2",
    });
  });

  it("returns null for bare path present in both repos", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("src/shared.ts:1"))).toBeNull();
  });

  it("returns null for missing file", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("repo-a/src/missing.ts:1"))).toBeNull();
    expect(resolve(cite("missing.ts:1"))).toBeNull();
  });

  it("drops anchor when startLine is beyond EOF", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("repo-a/src/shared.ts:99"))).toEqual({
      url: `https://github.com/org/repo-a/blob/${SHA_A}/src/shared.ts`,
      label: "src/shared.ts",
    });
  });

  it("omits anchor for binary files", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("repo-a/bin.dat:1"))).toEqual({
      url: `https://github.com/org/repo-a/blob/${SHA_A}/bin.dat`,
      label: "bin.dat",
    });
  });

  it("label drops repo-dir prefix and shows start-end", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    const target = resolve(cite("repo-b/only-b.ts:1-2"));
    expect(target?.label).toBe("only-b.ts:1-2");
  });

  it("uses single-line anchor when end <= start after clamping", () => {
    const resolve = createWikiSourceCitationResolver(contexts);
    expect(resolve(cite("repo-a/src/shared.ts:3-99"))).toEqual({
      url: `https://github.com/org/repo-a/blob/${SHA_A}/src/shared.ts#L3`,
      label: "src/shared.ts:3",
    });
  });
});
