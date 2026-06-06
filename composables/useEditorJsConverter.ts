import type EditorJS from "@editorjs/editorjs";

export interface EditorJsData {
  time?: number;
  version?: string;
  blocks: Array<{
    type: string;
    data: Record<string, any>;
  }>;
}

// ── Markdown → Editor.js JSON ─────────────────────────────────
export function markdownToEditorJs(md: string): EditorJsData {
  const blocks: EditorJsData["blocks"] = [];
  const lines = md.split("\n");
  let i = 0;

  function flushParagraph(buffer: string[]) {
    if (buffer.length > 0) {
      const text = buffer.join("\n").trim();
      if (text) {
        blocks.push({
          type: "paragraph",
          data: { text: inlineMarkdownToHtml(text) },
        });
      }
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Delimiter
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      blocks.push({ type: "delimiter", data: {} });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        type: "header",
        data: { text: escapeHtml(text), level },
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({
        type: "code",
        data: { code: codeLines.join("\n"), language: language || "plaintext" },
      });
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("|")) {
      const headerCells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c !== "");
      i++;
      // skip separator line
      if (i < lines.length && /^[-\s:|]+$/.test(lines[i])) i++;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c !== "");
        rows.push(cells);
        i++;
      }
      blocks.push({
        type: "table",
        data: {
          withHeadings: true,
          content: [headerCells, ...rows],
        },
      });
      continue;
    }

    // Quote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: "quote",
        data: {
          text: inlineMarkdownToHtml(quoteLines.join("\n")),
          alignment: "left",
        },
      });
      continue;
    }

    // List (bullet, ordered, checklist)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: Array<{ content: string; meta: Record<string, any>; items: any[] }> = [];
      let listStyle: "unordered" | "ordered" = "unordered";
      if (/^\d+\./.test(listMatch[2])) listStyle = "ordered";

      while (i < lines.length) {
        const currentLine = lines[i];
        const currentMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (!currentMatch) break;
        if (/^\d+\./.test(currentMatch[2])) listStyle = "ordered";
        items.push({ content: inlineMarkdownToHtml(currentMatch[3]), meta: {}, items: [] });
        i++;
      }
      blocks.push({
        type: "list",
        data: { style: listStyle, items },
      });
      continue;
    }

    // Nested list (with indentation)
    const nestedListMatch = line.match(/^(\s+)([-*]|\d+\.)\s+(.+)$/);
    if (nestedListMatch) {
      const baseIndent = nestedListMatch[1].length;
      let listStyle: "unordered" | "ordered" = "unordered";
      if (/^\d+\./.test(nestedListMatch[2])) listStyle = "ordered";

      const parseNestedList = (startIdx: number, minIndent: number): { items: Array<{ content: string; meta: Record<string, any>; items: any[] }>; nextIdx: number } => {
        const items: Array<{ content: string; meta: Record<string, any>; items: any[] }> = [];
        let idx = startIdx;

        while (idx < lines.length) {
          const currentLine = lines[idx];
          const match = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
          if (!match) break;

          const indent = match[1].length;
          if (indent < minIndent) break;

          if (indent === minIndent) {
            if (/^\d+\./.test(match[2])) listStyle = "ordered";
            const content = inlineMarkdownToHtml(match[3]);
            idx++;

            // Check for nested items
            const nested = parseNestedList(idx, minIndent + 2);
            items.push({ content, meta: {}, items: nested.items });
            idx = nested.nextIdx;
          } else {
            break;
          }
        }

        return { items, nextIdx: idx };
      };

      const result = parseNestedList(i, baseIndent);
      blocks.push({
        type: "nestedList",
        data: { style: listStyle, items: result.items },
      });
      i = result.nextIdx;
      continue;
    }

    // Toggle block (using HTML details/summary syntax)
    const toggleMatch = line.match(/^<details>\s*<summary>(.+)<\/summary>\s*$/);
    if (toggleMatch || line.trim().startsWith(":::toggle")) {
      const title = toggleMatch ? toggleMatch[1] : line.replace(":::toggle", "").trim();
      const content: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::") && !lines[i].trim().startsWith("</details>")) {
        content.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing
      blocks.push({
        type: "toggle",
        data: {
          title: title || "Toggle",
          items: content.length > 0 ? markdownToEditorJs(content.join("\n")).blocks : [],
        },
      });
      continue;
    }

    // Mermaid diagram
    if (line.trim().startsWith("```mermaid")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({
        type: "mermaid",
        data: { code: codeLines.join("\n") },
      });
      continue;
    }

    // Checklist
    if (line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      const items: Array<{ text: string; checked: boolean }> = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine.startsWith("- [ ] ")) {
          items.push({ text: inlineMarkdownToHtml(currentLine.slice(6)), checked: false });
          i++;
        } else if (currentLine.startsWith("- [x] ") || currentLine.startsWith("- [X] ")) {
          items.push({ text: inlineMarkdownToHtml(currentLine.slice(6)), checked: true });
          i++;
        } else break;
      }
      blocks.push({
        type: "checklist",
        data: { items },
      });
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const url = imageMatch[2];
      // Video embeds (YouTube, Vimeo) – use embed block
      if (/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)/.test(url)) {
        blocks.push({
          type: "embed",
          data: { service: url.includes("vimeo") ? "vimeo" : "youtube", source: url, embed: "", width: 580, height: 320, caption: imageMatch[1] },
        });
      } else {
        blocks.push({
          type: "image",
          data: { url, caption: imageMatch[1], withBorder: false, withBackground: false, stretched: false },
        });
      }
      i++;
      continue;
    }

    // Paragraph (collect until next block)
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,3}|>|[-*]|\d+\.|```|!\[|---|\||:::toggle)/)) {
      paraLines.push(lines[i]);
      i++;
    }
    flushParagraph(paraLines);
  }

  return { time: Date.now(), version: "2.29.0", blocks };
}

// ── Editor.js JSON → Markdown ─────────────────────────────────
export function editorJsToMarkdown(data: EditorJsData): string {
  const blocks = data.blocks || [];
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const level = block.data.level || 2;
        const hashes = "#".repeat(level);
        out.push(`${hashes} ${block.data.text || ""}`);
        break;
      }
      case "paragraph": {
        const text = htmlToInlineMarkdown(block.data.text || "");
        out.push(text);
        break;
      }
      case "list": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const content = typeof item === "string" ? item : item.content || "";
          const text = htmlToInlineMarkdown(content);
          if (style === "ordered") {
            out.push(`${idx + 1}. ${text}`);
          } else {
            out.push(`- ${text}`);
          }
        }
        break;
      }
      case "checklist": {
        const items = block.data.items || [];
        for (const item of items) {
          const checked = item.checked ? "x" : " ";
          const text = htmlToInlineMarkdown(item.text || "");
          out.push(`- [${checked}] ${text}`);
        }
        break;
      }
      case "code": {
        const language = block.data.language || "";
        out.push(`\`\`\`${language}`);
        out.push(block.data.code || "");
        out.push("```");
        break;
      }
      case "quote": {
        const text = htmlToInlineMarkdown(block.data.text || "");
        const lines = text.split("\n");
        for (const line of lines) {
          out.push(`> ${line}`);
        }
        break;
      }
      case "image": {
        const caption = block.data.caption || "";
        const url = block.data.url || "";
        out.push(`![${caption}](${url})`);
        break;
      }
      case "embed": {
        const caption = block.data.caption || "";
        const source = block.data.source || "";
        out.push(`![${caption}](${source})`);
        break;
      }
      case "table": {
        const content = block.data.content || [];
        if (content.length > 0) {
          const header = content[0];
          out.push(`| ${header.join(" | ")} |`);
          out.push(`| ${header.map(() => "---").join(" | ")} |`);
          for (let r = 1; r < content.length; r++) {
            out.push(`| ${content[r].join(" | ")} |`);
          }
        }
        break;
      }
      case "delimiter": {
        out.push("---");
        break;
      }
      case "warning": {
        out.push(`> **Warning:** ${block.data.title || ""}`);
        if (block.data.message) {
          out.push(`> ${block.data.message}`);
        }
        break;
      }
      case "nestedList": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const renderNestedList = (items: any[], indent: number, style: string): string[] => {
          const lines: string[] = [];
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const content = typeof item === "string" ? item : item.content || "";
            const text = htmlToInlineMarkdown(content);
            const prefix = " ".repeat(indent) + (style === "ordered" ? `${idx + 1}. ` : "- ");
            lines.push(`${prefix}${text}`);
            if (item.items && item.items.length > 0) {
              lines.push(...renderNestedList(item.items, indent + 2, style));
            }
          }
          return lines;
        };
        out.push(...renderNestedList(items, 0, style));
        break;
      }
      case "toggle": {
        const title = block.data.title || "Toggle";
        out.push(`:::toggle ${title}`);
        const items = block.data.items || [];
        if (items.length > 0) {
          const nestedMd = editorJsToMarkdown({ time: Date.now(), version: "2.29.0", blocks: items });
          out.push(...nestedMd.split("\n"));
        }
        out.push(":::");
        break;
      }
      case "mermaid": {
        out.push("```mermaid");
        out.push(block.data.code || "");
        out.push("```");
        break;
      }
      default:
        break;
    }
  }

  return out.join("\n");
}

// ── Inline helpers ─────────────────────────────────────────────
function inlineMarkdownToHtml(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function htmlToInlineMarkdown(html: string): string {
  return html
    .replace(/<strong><em>(.*?)<\/em><\/strong>/g, "***$1***")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<a href="([^"]+)">(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Extract headings from Editor.js data ───────────────────────
export function extractEditorJsHeadings(data: EditorJsData): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  for (const block of data.blocks || []) {
    if (block.type === "header") {
      headings.push({
        level: block.data.level || 2,
        text: stripHtml(block.data.text || ""),
      });
    }
  }
  return headings;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

// ── Export / Import helpers ───────────────────────────────────
export function editorJsToHtml(data: EditorJsData): string {
  const blocks = data.blocks || [];
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const level = block.data.level || 2;
        const tag = `h${level}`;
        out.push(`<${tag}>${block.data.text || ""}</${tag}>`);
        break;
      }
      case "paragraph": {
        out.push(`<p>${block.data.text || ""}</p>`);
        break;
      }
      case "list": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const tag = style === "ordered" ? "ol" : "ul";
        const lis = items.map((item: any) => {
          const content = typeof item === "string" ? item : item.content || "";
          return `<li>${content}</li>`;
        }).join("");
        out.push(`<${tag}>${lis}</${tag}>`);
        break;
      }
      case "checklist": {
        const items = block.data.items || [];
        const lis = items.map((item: any) => {
          const checked = item.checked ? "checked" : "";
          return `<li style="list-style:none;"><input type="checkbox" disabled ${checked} style="margin-right:6px;">${item.text || ""}</li>`;
        }).join("");
        out.push(`<ul>${lis}</ul>`);
        break;
      }
      case "code": {
        const code = escapeHtml(block.data.code || "");
        out.push(`<pre><code>${code}</code></pre>`);
        break;
      }
      case "quote": {
        out.push(`<blockquote>${block.data.text || ""}</blockquote>`);
        break;
      }
      case "image": {
        const url = block.data.url || "";
        const caption = block.data.caption || "";
        out.push(`<img src="${url}" alt="${caption}" />`);
        break;
      }
      case "table": {
        const content = block.data.content || [];
        if (content.length > 0) {
          let html = "<table><thead><tr>";
          const header = content[0];
          header.forEach((c: string) => {
            html += `<th>${c}</th>`;
          });
          html += "</tr></thead><tbody>";
          for (let r = 1; r < content.length; r++) {
            html += "<tr>";
            content[r].forEach((c: string) => {
              html += `<td>${c}</td>`;
            });
            html += "</tr>";
          }
          html += "</tbody></table>";
          out.push(html);
        }
        break;
      }
      case "embed": {
        const embed = block.data.embed || "";
        const caption = block.data.caption || "";
        const width = block.data.width || 580;
        const height = block.data.height || 320;
        if (embed) {
          out.push(`<iframe src="${embed}" width="${width}" height="${height}" frameborder="0" allowfullscreen style="max-width:100%;"></iframe>`);
        }
        if (caption) {
          out.push(`<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${caption}</p>`);
        }
        break;
      }
      case "delimiter": {
        out.push("<hr>");
        break;
      }
      case "nestedList": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const tag = style === "ordered" ? "ol" : "ul";
        const renderNestedHtml = (items: any[]): string => {
          return items.map((item: any) => {
            const content = typeof item === "string" ? item : item.content || "";
            let html = `<li>${content}`;
            if (item.items && item.items.length > 0) {
              html += `<${tag}>${renderNestedHtml(item.items)}</${tag}>`;
            }
            html += "</li>";
            return html;
          }).join("");
        };
        out.push(`<${tag}>${renderNestedHtml(items)}</${tag}>`);
        break;
      }
      case "toggle": {
        const title = block.data.title || "Toggle";
        const items = block.data.items || [];
        let innerHtml = "";
        if (items.length > 0) {
          innerHtml = editorJsToHtml({ time: Date.now(), version: "2.29.0", blocks: items });
        }
        out.push(`<details><summary>${title}</summary><div>${innerHtml}</div></details>`);
        break;
      }
      case "mermaid": {
        const code = escapeHtml(block.data.code || "");
        out.push(`<pre class="mermaid">${code}</pre>`);
        break;
      }
      default:
        break;
    }
  }

  return out.join("\n");
}
