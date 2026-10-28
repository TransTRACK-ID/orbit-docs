import { beforeAll, describe, expect, it } from "vitest";
import mermaid from "mermaid";
import { decodeMermaidEntities, isMermaidErrorSvg, normalizeMermaidSource, mermaidPreHtml, readMermaidSourceFromNode } from "./mermaid-source";
import { fullDiagram, reportedAndChainDiagram } from "./mermaid-fixtures";

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

describe("normalizeMermaidSource edge-and repair", () => {
  it("repairs right-side and chains", () => {
    expect(
      normalizeMermaidSource("flowchart TB\n  SVC --> MAP and FMS and NOTIFY and OTHER")
    ).toContain("SVC --> MAP & FMS & NOTIFY & OTHER");
  });

  it("repairs left-side and chains", () => {
    expect(normalizeMermaidSource("flowchart TB\n  A and B --> C")).toBe(
      "flowchart TB\n  A & B --> C"
    );
  });

  it("preserves labels verbatim", () => {
    const input = [
      "flowchart TB",
      "  WB[Weight bridge and TMS]",
      "  subgraph users [Users and integrators]",
      "  A -->|salt and pepper| B",
      '  X["rock and roll"]',
      "  %% comment and more",
    ].join("\n");
    expect(normalizeMermaidSource(input)).toBe(input);
  });

  it("is idempotent and leaves valid & chains byte-unchanged", () => {
    const input = "flowchart TB\n  SVC --> MAP and FMS and NOTIFY and OTHER";
    expect(normalizeMermaidSource(normalizeMermaidSource(input))).toBe(
      normalizeMermaidSource(input)
    );
    const valid = "flowchart TB\n  A --> B & C";
    expect(normalizeMermaidSource(valid)).toBe(valid);
  });
});

describe("mermaid parser regression", () => {
  beforeAll(() => {
    mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });
  });

  it("rejects the reported diagram before repair and parses it after", async () => {
    await expect(mermaid.parse(reportedAndChainDiagram)).rejects.toThrow();
    await expect(
      mermaid.parse(normalizeMermaidSource(reportedAndChainDiagram))
    ).resolves.toBeTruthy();
  });

  it("parses the fullDiagram control after normalization", async () => {
    await expect(
      mermaid.parse(normalizeMermaidSource(fullDiagram))
    ).resolves.toBeTruthy();
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
