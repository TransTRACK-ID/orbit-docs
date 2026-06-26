import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  editorJsToMarkdown,
  htmlToEditorJsBlocks,
  markdownToEditorJs,
  normalizeEditorHtml,
  sanitizeEditorJsData,
} from "./useEditorJsConverter";

describe("decodeHtmlEntities", () => {
  it("decodes single-encoded HTML entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes double-encoded entities from Notion paste", () => {
    expect(decodeHtmlEntities("Tom &amp;amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("A &amp;lt; B &amp;gt; C")).toBe("A < B > C");
  });

  it("leaves plain text unchanged", () => {
    expect(decodeHtmlEntities("hello world")).toBe("hello world");
  });
});

describe("normalizeEditorHtml", () => {
  it("decodes entity text inside inline HTML", () => {
    const normalized = normalizeEditorHtml("<strong>Tom &amp;amp; Jerry</strong>");
    const el = document.createElement("div");
    el.innerHTML = normalized;
    expect(el.textContent).toBe("Tom & Jerry");
  });
});

describe("htmlToEditorJsBlocks", () => {
  it("converts pasted Notion HTML with decoded ampersands", () => {
    const html = "<meta charset='utf-8'><p>Tom &amp;amp; Jerry</p><h2>API &amp;amp; Auth</h2>";
    const blocks = htmlToEditorJsBlocks(html);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("header");

    const paragraph = document.createElement("div");
    paragraph.innerHTML = blocks[0].data.text;
    expect(paragraph.textContent).toBe("Tom & Jerry");

    const heading = document.createElement("div");
    heading.innerHTML = blocks[1].data.text;
    expect(heading.textContent).toBe("API & Auth");
  });
});

describe("sanitizeEditorJsData", () => {
  it("cleans encoded text fields before markdown export", () => {
    const data = {
      blocks: [
        { type: "paragraph", data: { text: "Tom &amp;amp; Jerry" } },
        { type: "header", data: { text: "Guide &amp;amp; Setup", level: 2 } },
      ],
    };

    const sanitized = sanitizeEditorJsData(data);
    const markdown = editorJsToMarkdown(sanitized);

    expect(markdown).toContain("Tom & Jerry");
    expect(markdown).toContain("Guide & Setup");
  });
});

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
