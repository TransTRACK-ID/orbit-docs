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

export function headingSlug(text: string): string {
  const plain = text.replace(/<[^>]+>/g, "");
  let slug = plain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (/^\d/.test(slug)) slug = "h-" + slug;
  return slug;
}

function preprocessNotionImageMarkdown(md: string): string {
  return md.replace(
    /^!([^!\[\n]+\.(?:gif|jpe?g|png|webp|tiff|svg|bmp))$/gim,
    (_match, filename: string) => {
      const name = filename.trim();
      if (/^(https?:|data:image\/|blob:)/i.test(name)) {
        return `![${name.replace(/\.[^.]+$/, "")}](${name})`;
      }
      return `*[Image unavailable: ${name}. Re-copy the GIF from Notion and paste it here.]*`;
    }
  );
}

export function renderMarkdown(md: string): string {
  try {
    const prepared = preprocessNotionImageMarkdown(md);
    const renderer = new marked.Renderer();

    // ─── Escape raw HTML instead of rendering it ─────────────────
    renderer.html = ({ text }: { text: string }) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    // ─── Headings with slug IDs for h2 and h3 ───────────────────
    renderer.heading = function ({ tokens, depth }: { tokens: any[]; depth: number }) {
      const text = this.parser.parseInline(tokens);
      // Strip HTML tags for slug generation
      const plain = text.replace(/<[^>]+>/g, "");
      if (depth === 2 || depth === 3) {
        const slug = headingSlug(plain);
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
    renderer.image = ({ href, title, text }: { href: string; title: string | null; text: string }) => {
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
    renderer.blockquote = function ({ tokens }: { tokens: any[] }) {
      const body = this.parser.parse(tokens);
      // GFM alerts: > [!NOTE], > [!TIP], etc.
      // After parsing, the body is rendered HTML. The alert tag appears as:
      // <p>[!TYPE]<br>...content</p> or <p>[!TYPE]\n...content</p>
      const alertMatch = body.match(/^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?\s*/i);
      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const alertInfo = GFM_ALERT_TYPES[type];
        if (alertInfo) {
          // Remove the [!TYPE] tag from content
          const content = body.replace(alertMatch[0], "<p>");
          return `<div class="markdown-alert ${alertInfo.className}">
  <p class="markdown-alert-title">${alertInfo.icon} ${alertInfo.label}</p>
  ${content}
</div>\n`;
        }
      }
      return `<blockquote>${body}</blockquote>\n`;
    };

    // ─── Task list items ────────────────────────────────────────
    renderer.listitem = function (item: { tokens: any[]; task: boolean; checked?: boolean; loose: boolean }) {
      const body = this.parser.parse(item.tokens, item.loose);
      if (item.task) {
        return `<li class="task-list-item"><input type="checkbox" ${item.checked ? "checked" : ""} disabled class="task-list-checkbox" />${body}</li>\n`;
      }
      return `<li>${body}</li>\n`;
    };

    return marked.parse(prepared, { async: false, renderer, gfm: true, breaks: false }) as string;
  } catch (e: any) {
    console.error("Marked parsing error:", e);
    return `<div style="color:red; font-weight:bold; padding: 1rem; border: 1px solid red; background: #fff0f0;">Marked Error: ${e.message}</div><pre>${md}</pre>`;
  }
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
