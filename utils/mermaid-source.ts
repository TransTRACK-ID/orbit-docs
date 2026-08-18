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

/** Normalize AI-generated mermaid before parse/render. */
export function normalizeMermaidSource(source: string): string {
  return decodeMermaidEntities(
    source
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u00a0/g, " ")
      .trim()
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
