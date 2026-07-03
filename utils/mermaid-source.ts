/** Normalize AI-generated mermaid before parse/render. */
export function normalizeMermaidSource(source: string): string {
  return source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/^```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function isMermaidErrorSvg(svg: string): boolean {
  return svg.includes("error-text") || svg.includes("Syntax error in text");
}
