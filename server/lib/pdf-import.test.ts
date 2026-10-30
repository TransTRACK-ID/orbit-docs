import { describe, expect, it } from "vitest";
import { batchPages, cleanModelMarkdown, looksLikeScannedPdf } from "~/server/lib/pdf-import";
import { matchesDocAssetSignature } from "~/server/lib/s3-storage";

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
