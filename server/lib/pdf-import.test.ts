import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/lib/cursor-agent", () => ({
  isCursorInstalled: vi.fn(),
  isCursorAuthenticated: vi.fn(),
  createCursorAgent: vi.fn(),
}));

import { isCursorAuthenticated, isCursorInstalled } from "~/server/lib/cursor-agent";
import {
  batchPages,
  cleanModelMarkdown,
  lastMarkdownBlock,
  looksLikeScannedPdf,
  pagesToStructuredMarkdown,
  resolvePdfImportBackend,
  type PdfTextItem,
} from "~/server/lib/pdf-import";
import { matchesDocAssetSignature } from "~/server/lib/s3-storage";

const run = (str: string, x: number, y: number, fontSize = 12): PdfTextItem => ({
  str,
  x,
  y,
  fontSize,
  width: str.length * fontSize * 0.5,
});

const footer = (page: number) => [run("www.example.co Guide V.1.0", 20, 10, 10), run(`Page | ${page}`, 500, 10, 10)];

describe("pagesToStructuredMarkdown", () => {
  it("detects headings by font size and splits paragraphs on large vertical gaps", () => {
    const [page] = pagesToStructuredMarkdown([
      [
        run("Wrapped body line two.", 50, 682),
        run("OVERVIEW", 50, 740, 20),
        run("First paragraph line one that", 50, 696),
        run("Second paragraph.", 50, 640),
      ],
    ]);
    expect(page).toBe("# OVERVIEW\n\nFirst paragraph line one that Wrapped body line two.\n\nSecond paragraph.");
  });

  it("drops headers and footers repeated across pages, plus stray page numbers", () => {
    const bodies = ["Intro text.", "Setup text.", "Usage text."];
    const pages = bodies.map((body, i) => [
      run("User Guide", 50, 780, 10),
      run(body, 50, 700),
      run(String(i + 1), 300, 30),
      ...footer(i + 1),
    ]);
    expect(pagesToStructuredMarkdown(pages)).toEqual(bodies);
  });

  it("turns table-of-contents pages into nested lists", () => {
    const entries: [string, number, string][] = [
      ["AUTHENTICATION", 80, "8"],
      ["Login", 100, "9"],
      ["Logout", 100, "11"],
      ["USERS", 80, "13"],
      ["Add User", 100, "14"],
    ];
    const items = entries.flatMap(([title, x, pageNo], i) => [run(title, x, 700 - i * 24), run(pageNo, 530, 700 - i * 24)]);
    items.push(run("Glossary ............ 42", 80, 500));
    const [page] = pagesToStructuredMarkdown([items]);
    expect(page).toContain("- AUTHENTICATION\n  - Login\n  - Logout\n- USERS\n  - Add User");
    expect(page).toContain("- Glossary");
    expect(page).not.toMatch(/\d/);
  });

  it("keeps numbered steps and drops screenshot callout numbers", () => {
    const [page] = pagesToStructuredMarkdown([
      [run("1", 90, 720), run("2", 110, 690), run("1 Click the Login button.", 300, 720), run("2 Enter your email.", 300, 690)],
    ]);
    expect(page).toBe("1. Click the Login button.\n2. Enter your email.");
  });
});

describe("resolvePdfImportBackend", () => {
  const original = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    vi.mocked(isCursorInstalled).mockResolvedValue(true);
    vi.mocked(isCursorAuthenticated).mockResolvedValue({ ok: true, method: "api_key" });
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = original;
  });

  it("prefers OpenAI when a key is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(await resolvePdfImportBackend()).toBe("openai");
  });

  it("falls back to Cursor when the key is empty and Cursor is ready", async () => {
    process.env.OPENAI_API_KEY = "";
    expect(await resolvePdfImportBackend()).toBe("cursor");
  });

  it("returns none when neither backend is available", async () => {
    process.env.OPENAI_API_KEY = "";
    vi.mocked(isCursorInstalled).mockResolvedValue(false);
    expect(await resolvePdfImportBackend()).toBe("none");
  });
});

describe("pdf import helpers", () => {
  it("flags PDFs without selectable text as scanned", () => {
    expect(looksLikeScannedPdf(["", "  \n "])).toBe(true);
    expect(looksLikeScannedPdf(["A real paragraph of extracted PDF text."])).toBe(false);
  });

  it("batches pages under the character budget without splitting a page", () => {
    const batches = batchPages(["a".repeat(40), "b".repeat(40), "c".repeat(40)], 100);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toContain("a".repeat(40));
    expect(batches[0]).toContain("b".repeat(40));
    expect(batches[1]).toContain("c".repeat(40));
  });

  it("strips reasoning and a wrapping markdown fence from model output", () => {
    const raw = "<think>plan</think>\n```markdown\n# Heading\n\nBody\n```";
    expect(cleanModelMarkdown(raw)).toBe("# Heading\n\nBody");
  });

  it("keeps only the last tagged block when the agent retries its answer", () => {
    const raw = "<markdown>\n# Draft\n</markdown>\nFixing a typo and re-sending.\n<markdown>\n# Final\n\nBody\n</markdown>";
    expect(lastMarkdownBlock(raw)).toBe("# Final\n\nBody");
    expect(lastMarkdownBlock("# Untagged")).toBe("# Untagged");
  });
});

describe("matchesDocAssetSignature", () => {
  it("accepts real PDF and video headers", () => {
    expect(matchesDocAssetSignature("pdf", Buffer.from("%PDF-1.7\n"))).toBe(true);
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom")]);
    expect(matchesDocAssetSignature("video", mp4)).toBe(true);
    expect(matchesDocAssetSignature("video", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe(true);
  });

  it("rejects files that only claim the type", () => {
    expect(matchesDocAssetSignature("pdf", Buffer.from("<html>"))).toBe(false);
    expect(matchesDocAssetSignature("video", Buffer.from("%PDF-1.7"))).toBe(false);
  });
});
