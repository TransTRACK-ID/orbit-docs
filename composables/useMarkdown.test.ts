import { describe, expect, it } from "vitest";
import { renderMarkdown, extractHeadings } from "./useMarkdown";

describe("renderMarkdown", () => {
  it("should render headings", () => {
    const md = "# Hello\n## World";
    const html = renderMarkdown(md);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain('<h2 id="world">World</h2>');
  });

  it("should render paragraphs", () => {
    const md = "Hello world";
    const html = renderMarkdown(md);
    expect(html).toContain("<p>Hello world</p>");
  });

  it("should render bold and italic", () => {
    const md = "**bold** and *italic*";
    const html = renderMarkdown(md);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("should render code blocks", () => {
    const md = "```\nconst x = 1;\n```";
    const html = renderMarkdown(md);
    expect(html).toContain("<pre><code>");
    expect(html).toContain("const x = 1;");
  });

  it("should render unordered lists", () => {
    const md = "- Item 1\n- Item 2";
    const html = renderMarkdown(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
  });

  it("should render ordered lists", () => {
    const md = "1. First\n2. Second";
    const html = renderMarkdown(md);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain("<li>Second</li>");
  });

  it("should render links", () => {
    const md = "[link](https://example.com)";
    const html = renderMarkdown(md);
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it("should render colored links saved from the editor", () => {
    const md =
      '<a href="https://example.com" target="_blank" rel="nofollow noopener noreferrer"><font color="#FF1300">link</font></a>';
    const html = renderMarkdown(md);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<font color="#FF1300">link</font>');
    expect(html).not.toContain("&lt;font");
  });

  it("should render horizontal rules", () => {
    expect(renderMarkdown("---")).toContain("<hr>");
    expect(renderMarkdown("***")).toContain("<hr>");
  });

  it("should render blockquotes", () => {
    const md = "> quote";
    const html = renderMarkdown(md);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quote");
    expect(html).toContain("</blockquote>");
  });

  it("should render tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("should render checkboxes", () => {
    const md = "- [ ] Todo\n- [x] Done";
    const html = renderMarkdown(md);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Todo");
    expect(html).toContain("Done");
  });

  it("should escape html characters", () => {
    const md = "<script>alert(1)</script>";
    const html = renderMarkdown(md);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should render images", () => {
    const md = "![alt text](https://example.com/image.png)";
    const html = renderMarkdown(md);
    expect(html).toContain('<img src="https://example.com/image.png" alt="alt text" />');
  });

  it("should render YouTube embeds", () => {
    const md = "![video](https://youtube.com/watch?v=AbCdEfGhIjK)";
    const html = renderMarkdown(md);
    expect(html).toContain("<iframe");
    expect(html).toContain("https://www.youtube.com/embed/AbCdEfGhIjK");
  });

  it("should render Vimeo embeds", () => {
    const md = "![video](https://vimeo.com/123456789)";
    const html = renderMarkdown(md);
    expect(html).toContain("<iframe");
    expect(html).toContain("https://player.vimeo.com/video/123456789");
  });

  it("should render mermaid code blocks for client-side diagram rendering", () => {
    const md = "```mermaid\ngraph TD\n  A --> B\n```";
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("graph TD");
    expect(html).toContain("A --&gt; B");
    expect(html).not.toContain("<code>");
  });

  it("should show a helpful message for Notion attachment references", () => {
    const html = renderMarkdown("!bismillah ya Allaahhh.gif");
    expect(html).toContain("Image unavailable");
    expect(html).toContain("bismillah ya Allaahhh.gif");
  });
});

describe("extractHeadings", () => {
  it("should extract headings with levels", () => {
    const md = "# H1\n## H2\n### H3\nparagraph";
    const headings = extractHeadings(md);
    expect(headings).toEqual([
      { level: 1, text: "H1" },
      { level: 2, text: "H2" },
      { level: 3, text: "H3" },
    ]);
  });

  it("should return empty array for no headings", () => {
    expect(extractHeadings("no headings here")).toEqual([]);
  });
});
