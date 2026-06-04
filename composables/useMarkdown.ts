export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inTable = false;
  let tableHead: string[] = [];
  let tableBody: string[][] = [];

  // List tracking
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushCode() {
    if (codeBuffer.length) {
      const code = escapeHtml(codeBuffer.join("\n"));
      out.push(`<pre><code>${code}</code></pre>`);
      codeBuffer = [];
    }
  }

  function flushTable() {
    if (tableHead.length && tableBody.length) {
      let html = "<table><thead><tr>";
      tableHead.forEach((c) => {
        html += `<th>${inlineMd(c)}</th>`;
      });
      html += "</tr></thead><tbody>";
      tableBody.forEach((row) => {
        html += "<tr>";
        row.forEach((c) => {
          html += `<td>${inlineMd(c)}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table>";
      out.push(html);
    }
    tableHead = [];
    tableBody = [];
    inTable = false;
  }

  function flushList() {
    if (listBuffer.length && listType) {
      const tag = listType;
      out.push(`<${tag}>\n${listBuffer.join("\n")}\n</${tag}>`);
    }
    listBuffer = [];
    listType = null;
  }

  function pushBlock(html: string) {
    flushList();
    out.push(html);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      flushList();
      flushTable();
      out.push("<hr>");
      continue;
    }

    // Table detection
    if (line.includes("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c !== "");
      if (cells.length && cells.every((c) => /^[-\s:|]+$/.test(c))) {
        // separator line
        inTable = true;
        continue;
      }
      if (!inTable) {
        flushList();
        tableHead = cells;
        inTable = true;
      } else {
        tableBody.push(cells);
      }
      continue;
    } else if (inTable) {
      flushList();
      flushTable();
    }

    // Headings
    if (line.startsWith("# ")) {
      pushBlock(`<h1>${inlineMd(escapeHtml(line.slice(2)))}</h1>`);
    } else if (line.startsWith("## ")) {
      const text = line.slice(3);
      let slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (/^\d/.test(slug)) slug = "h-" + slug;
      pushBlock(`<h2 id="${slug}">${inlineMd(escapeHtml(text))}</h2>`);
    } else if (line.startsWith("### ")) {
      const text = line.slice(4);
      let slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (/^\d/.test(slug)) slug = "h-" + slug;
      pushBlock(`<h3 id="${slug}">${inlineMd(escapeHtml(text))}</h3>`);
    } else if (line.startsWith("> ")) {
      pushBlock(
        `<blockquote>${inlineMd(escapeHtml(line.slice(2)))}</blockquote>`
      );
    } else if (line.startsWith("- [ ] ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(
        `<li style="list-style:none;"><input type="checkbox" disabled style="margin-right:6px;">${inlineMd(escapeHtml(line.slice(6)))}</li>`
      );
    } else if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(
        `<li style="list-style:none;"><input type="checkbox" checked disabled style="margin-right:6px;">${inlineMd(escapeHtml(line.slice(6)))}</li>`
      );
    } else if (line.startsWith("- ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(`<li>${inlineMd(escapeHtml(line.slice(2)))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(
        `<li>${inlineMd(escapeHtml(line.replace(/^\d+\.\s/, "")))}</li>`
      );
    } else if (line.trim() === "") {
      flushList();
      // empty line
    } else {
      flushList();
      out.push(`<p>${inlineMd(escapeHtml(line))}</p>`);
    }
  }

  flushList();
  flushCode();
  flushTable();

  return out.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, url) => renderMediaEmbed(url, alt)
    );
}

function renderMediaEmbed(url: string, alt: string): string {
  // YouTube embed
  const youtubeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return `<iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" width="580" height="320" frameborder="0" allowfullscreen style="max-width:100%;border-radius:var(--radius);"></iframe>${alt ? `<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${alt}</p>` : ""}`;
  }
  // Vimeo embed
  const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" width="580" height="320" frameborder="0" allowfullscreen style="max-width:100%;border-radius:var(--radius);"></iframe>${alt ? `<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${alt}</p>` : ""}`;
  }
  // Default image
  return `<img src="${url}" alt="${alt}" />`;
}

export function extractHeadings(md: string): Array<{ level: number; text: string }> {
  const lines = md.split("\n");
  const headings: Array<{ level: number; text: string }> = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return headings;
}
