import { describe, expect, it } from "vitest";
import { isMermaidErrorSvg } from "./mermaid-source";

describe("isMermaidErrorSvg regression", () => {
  it("treats embedded error styles as success", () => {
    const svg =
      '<svg><style>#mermaid-id .error-text{fill:#552222;stroke:#552222;}</style><g class="nodes"></g></svg>';
    expect(isMermaidErrorSvg(svg)).toBe(false);
  });

  it("detects real syntax error output", () => {
    const svg =
      '<svg><text class="error-text">Syntax error in text</text></svg>';
    expect(isMermaidErrorSvg(svg)).toBe(true);
  });
});
