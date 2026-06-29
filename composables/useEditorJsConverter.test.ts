import { describe, expect, it } from "vitest";
import {
  alignBlocksWithPlainImages,
  createImageBlockData,
  decodeHtmlEntities,
  editorJsToMarkdown,
  htmlToEditorJsBlocks,
  isNotionImageReference,
  markdownToEditorJs,
  mergeNotionPasteBlocks,
  normalizeEditorHtml,
  reconcileNotionImageBlocks,
  readFileAsDataUrl,
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

  it("converts pasted GIF image HTML into image blocks", () => {
    const html = '<figure><img src="https://media.tenor.com/demo.gif" alt="Reaction GIF"><figcaption>Nice</figcaption></figure>';
    const blocks = htmlToEditorJsBlocks(html);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].data.url).toBe("https://media.tenor.com/demo.gif");
    expect(blocks[0].data.caption).toBe("Nice");
  });

  it("converts a paragraph with only an image into an image block", () => {
    const html = '<p><img src="https://example.com/animation.gif" alt="Loop"></p>';
    const blocks = htmlToEditorJsBlocks(html);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].data.url).toBe("https://example.com/animation.gif");
    expect(blocks[0].data.caption).toBe("Loop");
  });

  it("converts Notion attachment references into image blocks", () => {
    const data = markdownToEditorJs("!bismillah ya Allaahhh.gif");
    expect(data.blocks).toHaveLength(1);
    expect(data.blocks[0].type).toBe("image");
    expect(data.blocks[0].data.url).toBe("bismillah ya Allaahhh.gif");
  });

  it("converts a paragraph containing only a Notion GIF reference into an image block", () => {
    const html = "<p>!bismillah ya Allaahhh.gif</p>";
    const blocks = htmlToEditorJsBlocks(html);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].data.url).toBe("bismillah ya Allaahhh.gif");
  });

  it("round-trips image blocks with spaced filenames through markdown", () => {
    const data = {
      time: Date.now(),
      version: "2.29.0",
      blocks: [
        {
          type: "image",
          data: createImageBlockData("bismillah ya Allaahhh.gif", "bismillah ya Allaahhh"),
        },
      ],
    };

    const markdown = editorJsToMarkdown(data);
    expect(markdown).toContain("bismillah ya Allaahhh.gif");

    const parsed = markdownToEditorJs(markdown);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].type).toBe("image");
    expect(parsed.blocks[0].data.url).toBe("bismillah ya Allaahhh.gif");
  });
});

describe("reconcileNotionImageBlocks", () => {
  it("matches Notion placeholder text to clipboard GIF files", async () => {
    const file = new File([new Uint8Array([0x47, 0x49, 0x46])], "bismillah ya Allaahhh.gif", {
      type: "image/gif",
    });
    const blocks = await reconcileNotionImageBlocks(
      [{ type: "paragraph", data: { text: "!bismillah ya Allaahhh.gif" } }],
      [file]
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].data.url).toMatch(/^data:image\/gif;base64,/);
  });

  it("detects Notion image references in plain text", () => {
    expect(isNotionImageReference("!bismillah ya Allaahhh.gif")).toEqual({
      filename: "bismillah ya Allaahhh.gif",
    });
  });
});

describe("mergeNotionPasteBlocks", () => {
  const gifFile = new File([new Uint8Array([0x47, 0x49, 0x46])], "bismillah ya Allaahhh.gif", {
    type: "image/gif",
  });

  const plainText = `VESMON kini terhubung dengan penyedia data AIS terkemuka dunia, memberikan perspektif luar kapal yang presisi untuk manajemen logistik yang lebih baik:

- **Vessel Tracking & Portcall Activity:** Pelacakan posisi kapal dan aktivitas sandar secara akurat.

!bismillah ya Allaahhh.gif

- **Port Area Monitoring:** Pengawasan zona pelabuhan untuk optimasi manajemen antrian dan logistik.`;

  it("merges Notion HTML with omitted GIF and replaces the placeholder with the clipboard file", async () => {
    const html = `
      <p>VESMON kini terhubung dengan penyedia data AIS terkemuka dunia, memberikan perspektif luar kapal yang presisi untuk manajemen logistik yang lebih baik:</p>
      <ul>
        <li><strong>Vessel Tracking &amp; Portcall Activity:</strong> Pelacakan posisi kapal dan aktivitas sandar secara akurat.</li>
        <li><strong>Port Area Monitoring:</strong> Pengawasan zona pelabuhan untuk optimasi manajemen antrian dan logistik.</li>
      </ul>
    `;

    const blocks = await mergeNotionPasteBlocks(html, plainText, [gifFile]);

    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("list");
    expect(blocks[1].data.items).toHaveLength(1);
    expect(blocks[2].type).toBe("image");
    expect(blocks[2].data.url).toMatch(/^data:image\/gif;base64,/);
    expect(blocks[3].type).toBe("list");
    expect(blocks[3].data.items).toHaveLength(1);
  });

  it("handles Notion HTML that already splits the list around the GIF placeholder", async () => {
    const html = `
      <p>VESMON kini terhubung dengan penyedia data AIS terkemuka dunia, memberikan perspektif luar kapal yang presisi untuk manajemen logistik yang lebih baik:</p>
      <ul>
        <li><strong>Vessel Tracking &amp; Portcall Activity:</strong> Pelacakan posisi kapal dan aktivitas sandar secara akurat.</li>
      </ul>
      <p>!bismillah ya Allaahhh.gif</p>
      <ul>
        <li><strong>Port Area Monitoring:</strong> Pengawasan zona pelabuhan untuk optimasi manajemen antrian dan logistik.</li>
      </ul>
    `;

    const blocks = await mergeNotionPasteBlocks(html, plainText, [gifFile]);

    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("list");
    expect(blocks[2].type).toBe("image");
    expect(blocks[2].data.url).toMatch(/^data:image\/gif;base64,/);
    expect(blocks[3].type).toBe("list");
  });
});

describe("alignBlocksWithPlainImages", () => {
  it("splits merged HTML lists and inserts missing Notion GIF placeholders", () => {
    const htmlBlocks = [
      { type: "paragraph", data: { text: "intro" } },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [
            { content: "item 1", meta: {}, items: [] },
            { content: "item 2", meta: {}, items: [] },
          ],
        },
      },
    ];
    const plainBlocks = [
      { type: "paragraph", data: { text: "intro" } },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [{ content: "item 1", meta: {}, items: [] }],
        },
      },
      {
        type: "image",
        data: createImageBlockData("bismillah ya Allaahhh.gif", "bismillah ya Allaahhh"),
      },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [{ content: "item 2", meta: {}, items: [] }],
        },
      },
    ];

    const merged = alignBlocksWithPlainImages(htmlBlocks, plainBlocks);

    expect(merged).toHaveLength(4);
    expect(merged[0].type).toBe("paragraph");
    expect(merged[1].type).toBe("list");
    expect(merged[1].data.items).toHaveLength(1);
    expect(merged[2].type).toBe("image");
    expect(merged[2].data.caption).toBe("bismillah ya Allaahhh");
    expect(merged[3].type).toBe("list");
    expect(merged[3].data.items).toHaveLength(1);
  });

  it("extracts image-only list items from pasted HTML", () => {
    const html = `
      <ul>
        <li>First item</li>
        <li><img src="https://example.com/demo.gif" alt="demo"></li>
        <li>Second item</li>
      </ul>
    `;
    const blocks = htmlToEditorJsBlocks(html);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("list");
    expect(blocks[1].type).toBe("image");
    expect(blocks[1].data.url).toBe("https://example.com/demo.gif");
    expect(blocks[2].type).toBe("list");
  });

  it("does not duplicate images when HTML already contains the image and plain text has the placeholder", () => {
    const htmlBlocks = [
      { type: "paragraph", data: { text: "intro" } },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [
            { content: "item 1", meta: {}, items: [] },
            { content: "item 2", meta: {}, items: [] },
          ],
        },
      },
      {
        type: "image",
        data: createImageBlockData("https://example.com/figure.gif", "bismillah ya Allaahhh.gif"),
      },
    ];
    const plainBlocks = [
      { type: "paragraph", data: { text: "intro" } },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [{ content: "item 1", meta: {}, items: [] }],
        },
      },
      {
        type: "image",
        data: createImageBlockData("bismillah ya Allaahhh.gif", "bismillah ya Allaahhh"),
      },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [{ content: "item 2", meta: {}, items: [] }],
        },
      },
    ];

    const merged = alignBlocksWithPlainImages(htmlBlocks, plainBlocks);

    const imageBlocks = merged.filter((block) => block.type === "image");
    expect(imageBlocks).toHaveLength(1);
    expect(merged).toHaveLength(4);
    expect(merged[0].type).toBe("paragraph");
    expect(merged[1].type).toBe("list");
    expect(merged[2].type).toBe("image");
    expect(merged[3].type).toBe("list");
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

describe("inline link markdown round-trip", () => {
  it("preserves links with extra anchor attributes when toggling editor and preview", () => {
    const data = {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: '<a href="https://example.com/docs" target="_blank" rel="nofollow noopener noreferrer">example.com</a>',
          },
        },
      ],
    };

    const markdown = editorJsToMarkdown(data);
    expect(markdown).toBe("[example.com](https://example.com/docs)");

    const roundTrip = markdownToEditorJs(markdown);
    expect(roundTrip.blocks).toHaveLength(1);
    expect(roundTrip.blocks[0].type).toBe("paragraph");
    expect(roundTrip.blocks[0].data.text).toContain('href="https://example.com/docs"');
    expect(roundTrip.blocks[0].data.text).toContain("example.com");
  });

  it("preserves formatted link text in lists", () => {
    const data = {
      blocks: [
        {
          type: "list",
          data: {
            style: "unordered",
            items: [
              'See <a href="https://example.com" target="_blank" rel="nofollow">docs</a> for details',
            ],
          },
        },
      ],
    };

    const markdown = editorJsToMarkdown(data);
    expect(markdown).toContain("[docs](https://example.com)");

    const roundTrip = markdownToEditorJs(markdown);
    expect(roundTrip.blocks[0].data.items[0].content).toContain('href="https://example.com"');
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
