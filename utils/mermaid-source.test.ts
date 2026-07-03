import { describe, expect, it } from "vitest";
import { isMermaidErrorSvg, normalizeMermaidSource } from "./mermaid-source";

describe("normalizeMermaidSource", () => {
  it("strips accidental markdown fences", () => {
    const input = "```mermaid\ngraph TD\n  A --> B\n```";
    expect(normalizeMermaidSource(input)).toBe("graph TD\n  A --> B");
  });

  it("replaces smart quotes", () => {
    expect(normalizeMermaidSource("A[“label”]")).toBe('A["label"]');
  });
});

describe("isMermaidErrorSvg", () => {
  it("detects mermaid error output", () => {
    expect(isMermaidErrorSvg('<text class="error-text">Syntax error in text</text>')).toBe(
      true
    );
    expect(isMermaidErrorSvg("<svg><circle /></svg>")).toBe(false);
  });
});
