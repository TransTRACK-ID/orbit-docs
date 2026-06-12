import { marked } from "marked";

// Lazy-load highlight.js for code syntax highlighting
let _hljs: typeof import("highlight.js").default | null = null;
async function getHljs() {
  if (_hljs) return _hljs;
  const mod = await import("highlight.js");
  _hljs = mod.default;
  return _hljs;
}

// Synchronous highlight — only works after first async load.
// Falls back to plain escaped text if hljs hasn't loaded yet.
function highlightCode(code: string, lang?: string): string {
  if (!_hljs) return escapeHtml(code);
  try {
    if (lang && _hljs.getLanguage(lang)) {
      return _hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return _hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

// Pre-load highlight.js eagerly on client
if (import.meta.client) {
  getHljs();
}

// GitHub-style alert types
const GFM_ALERT_TYPES: Record<string, { icon: string; label: string; className: string }> = {
  NOTE: {
    icon: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
    label: "Note",
    className: "markdown-alert-note",
  },
  TIP: {
    icon: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>',
    label: "Tip",
    className: "markdown-alert-tip",
  },
  IMPORTANT: {
    icon: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
    label: "Important",
    className: "markdown-alert-important",
  },
  WARNING: {
    icon: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
    label: "Warning",
    className: "markdown-alert-warning",
  },
  CAUTION: {
    icon: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
    label: "Caution",
    className: "markdown-alert-caution",
  },
};

export function renderMarkdown(md: string): string {
  try {
    const renderer = new marked.Renderer();

    // ─── Escape raw HTML instead of rendering it ─────────────────
    renderer.html = (text: string) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    // ─── Headings with slug IDs for h2 and h3 ───────────────────
    renderer.heading = ({ text, depth }: { text: string; depth: number; raw: string }) => {
      if (depth === 2 || depth === 3) {
        let slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (/^\d/.test(slug)) slug = "h-" + slug;
        return `<h${depth} id="${slug}">${text}</h${depth}>`;
      }
      return `<h${depth}>${text}</h${depth}>`;
    };

    // ─── Code blocks: mermaid → pre.mermaid; others → highlighted ─
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      if (lang === "mermaid") {
        return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      }
      const highlighted = highlightCode(text, lang);
      if (lang) {
        return `<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>\n`;
      }
      return `<pre><code class="hljs">${highlighted}</code></pre>\n`;
    };

    // ─── Image renderer: YouTube/Vimeo embeds ───────────────────
    renderer.image = (href: string, title: string | null, text: string) => {
      // YouTube embed
      const youtubeMatch = href.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (youtubeMatch) {
        return `<iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" width="580" height="320" frameborder="0" allowfullscreen style="max-width:100%;border-radius:var(--radius);"></iframe>${text ? `<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${text}</p>` : ""}`;
      }
      // Vimeo embed
      const vimeoMatch = href.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" width="580" height="320" frameborder="0" allowfullscreen style="max-width:100%;border-radius:var(--radius);"></iframe>${text ? `<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${text}</p>` : ""}`;
      }
      return `<img src="${href}" alt="${text}" />`;
    };

    // ─── Blockquote: detect GFM-style alerts ────────────────────
    renderer.blockquote = ({ text }: { text: string }) => {
      // GFM alerts: > [!NOTE], > [!TIP], etc.
      // After marked processes the blockquote the inner text is already HTML.
      // The alert tag would be at the start as: <p>[!TYPE]<br>...content</p> or
      // <p>[!TYPE]\n...content</p>
      const alertMatch = text.match(/^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?\s*/i);
      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const alertInfo = GFM_ALERT_TYPES[type];
        if (alertInfo) {
          // Remove the [!TYPE] tag from content
          const content = text.replace(alertMatch[0], "<p>");
          return `<div class="markdown-alert ${alertInfo.className}">
  <p class="markdown-alert-title">${alertInfo.icon} ${alertInfo.label}</p>
  ${content}
</div>\n`;
        }
      }
      return `<blockquote>${text}</blockquote>\n`;
    };

    // ─── Task list items ────────────────────────────────────────
    renderer.listitem = ({ text, task, checked }: { text: string; task: boolean; checked: boolean }) => {
      if (task) {
        return `<li class="task-list-item"><input type="checkbox" ${checked ? "checked" : ""} disabled class="task-list-checkbox" />${text}</li>\n`;
      }
      return `<li>${text}</li>\n`;
    };

    return marked.parse(md, { async: false, renderer, gfm: true, breaks: false }) as string;
  } catch {
    // Fallback to simple rendering if marked fails
  }
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";
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
      if (codeLang === "mermaid") {
        out.push(`<pre class="mermaid">${code}</pre>`);
      } else {
        const highlighted = highlightCode(codeBuffer.join("\n"), codeLang);
        out.push(`<pre><code class="hljs${codeLang ? ` language-${escapeHtml(codeLang)}` : ""}">${highlighted}</code></pre>`);
      }
      codeBuffer = [];
      codeLang = "";
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
        codeLang = "";
      } else {
        flushList();
        codeLang = line.slice(3).trim();
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
        `<li class="task-list-item"><input type="checkbox" disabled class="task-list-checkbox">${inlineMd(escapeHtml(line.slice(6)))}</li>`
      );
    } else if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(
        `<li class="task-list-item"><input type="checkbox" checked disabled class="task-list-checkbox">${inlineMd(escapeHtml(line.slice(6)))}</li>`
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
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, url) => renderMediaEmbed(url, alt)
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
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
