export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inTable = false;
  let tableHead: string[] = [];
  let tableBody: string[][] = [];

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
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
        tableHead = cells;
        inTable = true;
      } else {
        tableBody.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("# ")) {
      out.push(`<h1>${inlineMd(escapeHtml(line.slice(2)))}</h1>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${inlineMd(escapeHtml(line.slice(3)))}</h2>`);
    } else if (line.startsWith("### ")) {
      out.push(`<h3>${inlineMd(escapeHtml(line.slice(4)))}</h3>`);
    } else if (line.startsWith("> ")) {
      out.push(
        `<blockquote>${inlineMd(escapeHtml(line.slice(2)))}</blockquote>`
      );
    } else if (line.startsWith("- [ ] ")) {
      out.push(
        `<li style="list-style:none;"><input type="checkbox" disabled style="margin-right:6px;">${inlineMd(escapeHtml(line.slice(6)))}</li>`
      );
    } else if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      out.push(
        `<li style="list-style:none;"><input type="checkbox" checked disabled style="margin-right:6px;">${inlineMd(escapeHtml(line.slice(6)))}</li>`
      );
    } else if (line.startsWith("- ")) {
      out.push(`<li>${inlineMd(escapeHtml(line.slice(2)))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      out.push(
        `<li>${inlineMd(escapeHtml(line.replace(/^\d+\. /, "")))}</li>`
      );
    } else if (line.trim() === "") {
      // empty line
    } else {
      out.push(`<p>${inlineMd(escapeHtml(line))}</p>`);
    }
  }

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
