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
      pushBlock(`<h2>${inlineMd(escapeHtml(line.slice(3)))}</h2>`);
    } else if (line.startsWith("### ")) {
      pushBlock(`<h3>${inlineMd(escapeHtml(line.slice(4)))}</h3>`);
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
      '<img src="$2" alt="$1" />'
    );
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
