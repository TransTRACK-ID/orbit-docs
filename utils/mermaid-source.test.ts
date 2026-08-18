import { describe, expect, it } from "vitest";
import { decodeMermaidEntities, isMermaidErrorSvg, normalizeMermaidSource, mermaidPreHtml, readMermaidSourceFromNode } from "./mermaid-source";

describe("decodeMermaidEntities", () => {
  it("decodes escaped line breaks without treating raw tags as HTML", () => {
    expect(decodeMermaidEntities('A["hello&lt;br/&gt;world"]')).toBe('A["hello<br/>world"]');
    expect(decodeMermaidEntities('A["hello<br/>world"]')).toBe('A["hello<br/>world"]');
  });
});

describe("mermaidPreHtml", () => {
  it("stores raw source in a data attribute", () => {
    const html = mermaidPreHtml("graph TD\n  A --> B");
    const container = document.createElement("div");
    container.innerHTML = html;
    const node = container.querySelector("pre.mermaid") as HTMLPreElement;
    expect(readMermaidSourceFromNode(node)).toBe("graph TD\n  A --> B");
  });
});

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

  it("does not false-positive on mermaid style blocks", () => {
    expect(
      isMermaidErrorSvg(
        "<svg><style>#graph .error-text{fill:#552222;}</style><circle /></svg>"
      )
    ).toBe(false);
  });
});
