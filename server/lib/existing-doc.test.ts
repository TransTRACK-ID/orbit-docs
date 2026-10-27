import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readExistingDoc } from "./existing-doc";

// Real temp files instead of fs mocks: Node builtins are externalized by
// Vitest, so vi.mock("fs") never reached the implementation and every
// case silently returned null.
let cloneDir: string;

function writeDoc(relativePath: string, content: string): void {
  const abs = join(cloneDir, relativePath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

beforeAll(() => {
  cloneDir = mkdtempSync(join(tmpdir(), "existing-doc-"));
});

afterAll(() => {
  rmSync(cloneDir, { recursive: true, force: true });
});

describe("readExistingDoc", () => {
  it("returns null when file does not exist", async () => {
    const result = await readExistingDoc(cloneDir, "docs/PRD.md");
    expect(result).toBeNull();
  });

  it("returns null when file is empty after trim", async () => {
    writeDoc("docs/EMPTY.md", "   \n   \n   ");
    const result = await readExistingDoc(cloneDir, "docs/EMPTY.md");
    expect(result).toBeNull();
  });

  it("returns trimmed content for a valid markdown file", async () => {
    const content = "# Product Requirements Document\n\nSome content here.\n";
    writeDoc("docs/PRD.md", content);
    const result = await readExistingDoc(cloneDir, "docs/PRD.md");
    expect(result).toBe(content.trim());
  });

  it("strips BOM when present", async () => {
    writeDoc("docs/BOM.md", "\uFEFF# Product Requirements Document\n\nContent\n");
    const result = await readExistingDoc(cloneDir, "docs/BOM.md");
    expect(result).toBe("# Product Requirements Document\n\nContent");
  });

  it("strips generated artifacts when docType is provided", async () => {
    const raw =
      "I'll analyze this repository now.\n\n" +
      "# System Design Document (SDD)\n\n" +
      "**Real content here**\n";
    writeDoc("docs/SDD.md", raw);
    const result = await readExistingDoc(cloneDir, "docs/SDD.md", "sdd");
    expect(result).toBe("# System Design Document (SDD)\n\n**Real content here**");
  });

  it("returns null on read error", async () => {
    // A directory at the doc path makes readFile throw (EISDIR).
    mkdirSync(join(cloneDir, "docs/DIR.md"), { recursive: true });
    const result = await readExistingDoc(cloneDir, "docs/DIR.md");
    expect(result).toBeNull();
  });
});
