import { describe, expect, it, vi } from "vitest";
import { readExistingDoc } from "./existing-doc";

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

import { readFile } from "fs/promises";
import { existsSync } from "fs";

describe("readExistingDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = await readExistingDoc("/clone/dir", "docs/PRD.md");
    expect(result).toBeNull();
    expect(existsSync).toHaveBeenCalledWith("/clone/dir/docs/PRD.md");
  });

  it("returns null when file is empty after trim", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue("   \n   \n   ");
    const result = await readExistingDoc("/clone/dir", "docs/PRD.md");
    expect(result).toBeNull();
  });

  it("returns trimmed content for a valid markdown file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const content = "# Product Requirements Document\n\nSome content here.\n";
    vi.mocked(readFile).mockResolvedValue(content);
    const result = await readExistingDoc("/clone/dir", "docs/PRD.md");
    expect(result).toBe(content.trim());
  });

  it("strips BOM when present", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const content = "\uFEFF# Product Requirements Document\n\nContent\n";
    vi.mocked(readFile).mockResolvedValue(content);
    const result = await readExistingDoc("/clone/dir", "docs/PRD.md");
    expect(result).toBe("# Product Requirements Document\n\nContent");
  });

  it("strips generated artifacts when docType is provided", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const raw =
      "I'll analyze this repository now.\n\n" +
      "# System Design Document (SDD)\n\n" +
      "**Real content here**\n";
    vi.mocked(readFile).mockResolvedValue(raw);
    const result = await readExistingDoc("/clone/dir", "docs/SDD.md", "sdd");
    expect(result).toBe("# System Design Document (SDD)\n\n**Real content here**");
  });

  it("returns null on read error", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockRejectedValue(new Error("Permission denied"));
    const result = await readExistingDoc("/clone/dir", "docs/PRD.md");
    expect(result).toBeNull();
  });
});
