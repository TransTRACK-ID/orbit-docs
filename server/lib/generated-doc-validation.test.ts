import { describe, expect, it } from "vitest";
import {
  looksTruncatedDocOutput,
  looksIncompleteDocUpdate,
  validateGeneratedDocContent,
} from "./generated-doc-validation";

describe("looksTruncatedDocOutput", () => {
  it("detects ellipsis placeholder patterns", () => {
    const sample =
      "## Daftar Isi\n\n[... full 1,120-line document in docs/SDD-Frontend.md ...]";
    expect(looksTruncatedDocOutput(sample)).toBe(true);
  });

  it("detects response length limit messages", () => {
    expect(
      looksTruncatedDocOutput("Because of response length limits, the complete markdown is in docs/SDD.md")
    ).toBe(true);
  });

  it("accepts normal markdown", () => {
    const doc = "# System Design Document (SDD)\n\n## Pendahuluan\n\nReal content here.";
    expect(looksTruncatedDocOutput(doc)).toBe(false);
  });
});

describe("looksIncompleteDocUpdate", () => {
  it("flags major shrink of large existing docs", () => {
    const existing = "x".repeat(10000);
    const newDoc = "y".repeat(1000);
    expect(looksIncompleteDocUpdate(newDoc, existing)).toBe(true);
  });

  it("allows proportional updates", () => {
    const existing = "x".repeat(10000);
    const newDoc = "y".repeat(8000);
    expect(looksIncompleteDocUpdate(newDoc, existing)).toBe(false);
  });
});

describe("validateGeneratedDocContent", () => {
  it("rejects truncated output", () => {
    const result = validateGeneratedDocContent("[... truncated ...]", "existing");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/truncated/i);
  });
});
