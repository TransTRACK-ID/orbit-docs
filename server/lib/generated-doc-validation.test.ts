import { describe, expect, it } from "vitest";
import {
  looksTruncatedDocOutput,
  looksIncompleteDocUpdate,
  looksLikeRawAgentOutput,
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

  it("allows merged updates that stay close to existing length", () => {
    const existing = "x".repeat(10000);
    const merged = existing.replace("xxxx", "yyyy"); // tiny patch, same length
    const result = validateGeneratedDocContent(merged, existing, { isMergedUpdate: true });
    expect(result.valid).toBe(true);
  });

  it("skips length heuristic for merged section updates", () => {
    const existing = "# Doc\n\n## A\n\n" + "x".repeat(5000) + "\n\n## B\n\nold";
    const merged = "# Doc\n\n## A\n\n" + "x".repeat(5000) + "\n\n## B\n\nnew short";
    const result = validateGeneratedDocContent(merged, existing, { isMergedUpdate: true });
    expect(result.valid).toBe(true);
  });

  it("rejects raw agent reasoning with embedded JSON", () => {
    const raw =
      'I\'ll read the existing PRD...\n{"heading":"# PRD","content":"| A | B |\\n|---|---|\\n| x | y |"}';
    expect(looksLikeRawAgentOutput(raw)).toBe(true);
    const result = validateGeneratedDocContent(raw, "existing doc");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/raw agent reasoning/i);
  });

  it("does not flag valid markdown containing heading/content strings as raw JSON", () => {
    const doc = `# Product Requirements Document (PRD) — MyApp

## Metadata

| Field | Value |
|---|---|
| "heading" | "content" |
| {key} | value |

## 1. Pendahuluan

Real content here.`;
    expect(looksLikeRawAgentOutput(doc)).toBe(false);
    const result = validateGeneratedDocContent(doc, "existing");
    expect(result.valid).toBe(true);
  });
});

describe("looksLikeRawAgentOutput — expanded preamble patterns", () => {
  it("detects 'I'll locate' preamble", () => {
    expect(looksLikeRawAgentOutput("I'll locate the existing product SDD and the per-repo design docs.")).toBe(true);
  });

  it("detects 'Product-root' preamble", () => {
    expect(looksLikeRawAgentOutput("Product-root docs/SDD.md is missing; I'll read the per-repo SDDs.")).toBe(true);
  });

  it("detects 'No product-root' preamble", () => {
    expect(looksLikeRawAgentOutput("No product-root docs/SDD.md exists; emitting JSON patches.")).toBe(true);
  });

  it("detects 'emitting JSON' preamble", () => {
    expect(looksLikeRawAgentOutput("emitting JSON patches for the template headings.")).toBe(true);
  });

  it("detects 'I'll patch' preamble", () => {
    expect(looksLikeRawAgentOutput("I'll patch only the sections that need updates.")).toBe(true);
  });

  it("detects 'Looking at' preamble", () => {
    expect(looksLikeRawAgentOutput("Looking at the repository structure to understand the codebase.")).toBe(true);
  });

  it("detects truncated JSON after preamble", () => {
    const raw =
      'I\'ll locate the existing product SDD.\n' +
      '{"sections":[{"heading":"## 1. Pendahuluan","content":"Intro';
    expect(looksLikeRawAgentOutput(raw)).toBe(true);
  });

  it("does not flag valid markdown with common phrases", () => {
    const doc = "## 1. Pendahuluan\n\nThis section introduces the product.\n\n## 2. Architecture\n\nDetails here.";
    expect(looksLikeRawAgentOutput(doc)).toBe(false);
  });
});
