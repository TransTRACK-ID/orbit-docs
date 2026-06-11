import { describe, expect, it } from "vitest";
import { markdownToEditorJs } from "./useEditorJsConverter";

describe("markdownToEditorJs mermaid", () => {
  it("should convert fenced mermaid blocks to mermaid editor blocks", () => {
    const md = "```mermaid\ngraph TD\n  A --> B\n```";
    const data = markdownToEditorJs(md);

    expect(data.blocks).toHaveLength(1);
    expect(data.blocks[0].type).toBe("mermaid");
    expect(data.blocks[0].data.code).toBe("graph TD\n  A --> B");
  });

  it("should convert unfenced flowchart syntax to mermaid editor blocks", () => {
    const md = `The service sits at the center of a multi-tier product architecture:

flowchart TB
    subgraph clients [Clients]
        FE[Nuxt 3 SPA]
    end`;

    const data = markdownToEditorJs(md);

    expect(data.blocks).toHaveLength(2);
    expect(data.blocks[0].type).toBe("paragraph");
    expect(data.blocks[1].type).toBe("mermaid");
    expect(data.blocks[1].data.code).toContain("flowchart TB");
    expect(data.blocks[1].data.code).toContain("subgraph clients");
  });
});
