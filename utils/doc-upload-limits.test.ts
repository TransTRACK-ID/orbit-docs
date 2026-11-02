import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOC_PDF_MAX_BYTES,
  DEFAULT_DOC_VIDEO_MAX_BYTES,
  getDocPdfMaxBytes,
  getDocVideoMaxBytes,
  validateDocAttachmentSize,
  validateDocImageSize,
} from "~/utils/doc-upload-limits";

describe("doc-upload-limits", () => {
  it("uses defaults when env is unset", () => {
    expect(getDocPdfMaxBytes()).toBe(DEFAULT_DOC_PDF_MAX_BYTES);
    expect(getDocVideoMaxBytes()).toBe(DEFAULT_DOC_VIDEO_MAX_BYTES);
  });

  it("parses positive env overrides", () => {
    expect(getDocPdfMaxBytes("1048576")).toBe(1048576);
    expect(getDocVideoMaxBytes("invalid")).toBe(DEFAULT_DOC_VIDEO_MAX_BYTES);
  });

  it("rejects oversized PDF attachments", () => {
    const file = new File([new Uint8Array(DEFAULT_DOC_PDF_MAX_BYTES + 1)], "a.pdf", {
      type: "application/pdf",
    });
    const message = validateDocAttachmentSize(file, DEFAULT_DOC_PDF_MAX_BYTES, DEFAULT_DOC_VIDEO_MAX_BYTES);
    expect(message).toMatch(/50 MB limit for PDF/);
  });

  it("rejects oversized inline images", () => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "a.png", { type: "image/png" });
    expect(validateDocImageSize(file, 10 * 1024 * 1024)).toMatch(/10 MB limit/);
  });
});
