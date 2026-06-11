export type GeneratedDocType = "srs" | "fsd" | "sdd";

const DOC_HEADING_RE: Record<GeneratedDocType, RegExp> = {
  srs: /^#\s+Software Requirements Specification\s*\(SRS\)/im,
  fsd: /^#\s+Functional Specification Document\s*\(FSD\)/im,
  sdd: /^#\s+System Design Document\s*\(SDD\)/im,
};

/**
 * Remove agent preamble / thinking text that sometimes precedes the final
 * markdown document (e.g. "I'll explore the repository structure...").
 */
export function stripGeneratedDocArtifacts(
  content: string,
  type?: GeneratedDocType
): string {
  if (!content) return content;

  let text = content.replace(/^\uFEFF/, "").trim();

  const fullFence = text.match(/^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  if (fullFence) {
    text = fullFence[1].trim();
  }

  let start = 0;
  if (type) {
    const match = text.match(DOC_HEADING_RE[type]);
    if (match?.index !== undefined) {
      start = match.index;
    }
  }

  if (start === 0) {
    const h1 = text.search(/^#\s+\S/m);
    if (h1 > 0) {
      start = h1;
    }
  }

  if (start > 0) {
    text = text.slice(start);
  }

  return text.trimStart();
}
