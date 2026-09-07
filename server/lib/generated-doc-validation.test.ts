import { describe, expect, it } from "vitest";
import {
  looksTruncatedDocOutput,
  looksIncompleteDocUpdate,
  looksLikeRawAgentOutput,
  isValidExistingDoc,
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
    const existing = "# Doc\n\n" + "x".repeat(10000);
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

  it("detects empty-section error JSON payloads", () => {
    const error1 =
      '{"sections":[],"revisionSummary":"Unable to perform an incremental update: docs/PRD.md contains only a prior error JSON and has no PRD section headings to patch."}';
    const error2 =
      '{"sections":[],"revisionSummary":"Unable to update: docs/PRD.md was not found in the product root or any of the three repositories."}';
    expect(looksLikeRawAgentOutput(error1)).toBe(true);
    expect(looksLikeRawAgentOutput(error2)).toBe(true);
  });

  it("detects 'I can't produce' error preamble", () => {
    const raw =
      "I can't produce the JSON: docs/GIT-SNAPSHOT.md does not exist in this repo, and it has never existed in git history (I checked all 5896 commits).";
    expect(looksLikeRawAgentOutput(raw)).toBe(true);
  });
});

describe("isValidExistingDoc", () => {
  it("rejects null, undefined, empty, or very short strings", () => {
    expect(isValidExistingDoc(null)).toBe(false);
    expect(isValidExistingDoc(undefined)).toBe(false);
    expect(isValidExistingDoc("")).toBe(false);
    expect(isValidExistingDoc("short")).toBe(false);
  });

  it("rejects error JSON from prior failed updates", () => {
    const errorJson =
      '{"sections":[],"revisionSummary":"Unable to perform an incremental update: docs/PRD.md contains only a prior error JSON and has no PRD section headings to patch."}';
    expect(isValidExistingDoc(errorJson)).toBe(false);
  });

  it("rejects raw agent preamble text", () => {
    const preamble =
      "I can't produce the JSON: docs/GIT-SNAPSHOT.md does not exist in this repo, and it has never existed in git history.";
    expect(isValidExistingDoc(preamble)).toBe(false);
  });

  it("rejects text without markdown headings", () => {
    const noHeadings =
      "This is just a long block of text describing the product, but it does not have any markdown headings at all so it cannot be patched.";
    expect(isValidExistingDoc(noHeadings)).toBe(false);
  });

  it("accepts valid markdown documents with headings", () => {
    const validPrd =
      "# Product Requirements Document (PRD)\n\n## 1. Pendahuluan\n\nThis is the real PRD content for the product.";
    expect(isValidExistingDoc(validPrd)).toBe(true);

    const validSdd =
      "## 1. Pendahuluan\n\nIntro\n\n## 2. Arsitektur\n\nDetails about system architecture.";
    expect(isValidExistingDoc(validSdd)).toBe(true);
  });
});
