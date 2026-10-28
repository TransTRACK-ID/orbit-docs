import { escapeHtmlAttr } from "~/composables/inlineColorHtml";

/** Iteratively decode HTML entities without interpreting raw tags as markup. */
export function decodeMermaidEntities(source: string): string {
  if (!source.includes("&")) return source;

  let prev = "";
  let current = source;
  while (current !== prev) {
    prev = current;
    current = current
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return current;
}

function repairEdgeAndChains(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      if (
        !line.includes("-->") &&
        !line.includes("---") &&
        !line.includes("-.->") &&
        !line.includes("==>")
      ) {
        return line;
      }
      let result = "";
      let inQuotes = false;
      let depth = 0;
      let inPipe = false;
      let i = 0;
      while (i < line.length) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          result += ch;
          i += 1;
          continue;
        }
        if (!inQuotes) {
          if (ch === "|" && depth === 0) {
            inPipe = !inPipe;
            result += ch;
            i += 1;
            continue;
          }
          if (!inPipe) {
            if (ch === "[" || ch === "(" || ch === "{") {
              depth += 1;
              result += ch;
              i += 1;
              continue;
            }
            if (ch === "]" || ch === ")" || ch === "}") {
              depth = Math.max(0, depth - 1);
              result += ch;
              i += 1;
              continue;
            }
          }
        }
        if (!inQuotes && !inPipe && depth === 0 && /\s/.test(ch)) {
          const match = /^\s+and\s+/.exec(line.slice(i));
          if (match) {
            result += " & ";
            i += match[0].length;
            continue;
          }
        }
        result += ch;
        i += 1;
      }
      return result;
    })
    .join("\n");
}

/** Normalize AI-generated mermaid before parse/render. */
export function normalizeMermaidSource(source: string): string {
  return repairEdgeAndChains(
    decodeMermaidEntities(
      source
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/^```(?:mermaid)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u00a0/g, " ")
        .trim()
    )
  );
}

export function encodeMermaidSourceAttr(source: string): string {
  return encodeURIComponent(source);
}

export function mermaidPreHtml(source: string): string {
  const encoded = escapeHtmlAttr(encodeMermaidSourceAttr(source));
  return `<pre class="mermaid" data-mermaid-source="${encoded}"></pre>\n`;
}

export function readMermaidSourceFromNode(node: HTMLPreElement): string {
  const encoded = node.getAttribute("data-mermaid-source");
  if (encoded) {
    try {
      return normalizeMermaidSource(decodeURIComponent(encoded));
    } catch {
      // Fall back to text content when the attribute is malformed.
    }
  }
  return normalizeMermaidSource(node.textContent || "");
}

export function isMermaidErrorSvg(svg: string): boolean {
  return (
    svg.includes("Syntax error in text") ||
    /<text[^>]*class="error-text"/i.test(svg)
  );
}
