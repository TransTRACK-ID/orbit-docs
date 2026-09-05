import {
  parseDocSectionUpdatePayload,
  tryBuildFullDocFromPayload,
  buildFullDocFromAllSections,
  extractDocSectionUpdateJson,
} from "./doc-section-merge";

export type GeneratedDocType = "srs" | "fsd" | "sdd";

const DOC_HEADING_RE: Record<GeneratedDocType, RegExp> = {
  srs:
    /^#\s+(?:Software Requirements Specification\s*\(SRS\)|Product Requirements Document\s*\(PRD\)|Dokumentasi Proyek)/im,
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
  let text = content.replace(/^\uFEFF/, "").trim();

  // If the content is a JSON section-update payload (possibly preceded by
  // agent preamble/thinking text), extract the markdown from it before
  // attempting heading-based stripping.
  if (text.includes('"heading"') && text.includes('"content"') && text.includes('{')) {
    try {
      const payload = parseDocSectionUpdatePayload(text);
      const fullDoc = tryBuildFullDocFromPayload(payload) ?? buildFullDocFromAllSections(payload);
      text = fullDoc.trim();
    } catch {
      // JSON is malformed/truncated — try to at least strip everything
      // before the first { in case there's usable JSON after preamble.
      const jsonStart = text.indexOf("{");
      if (jsonStart > 0) {
        try {
          const jsonOnly = text.slice(jsonStart);
          extractDocSectionUpdateJson(jsonOnly);
          text = jsonOnly;
        } catch {
          // Still malformed — continue with original text.
        }
      }
    }
  }
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
    } else if (h1 === -1) {
      // No H1 — try first H2 to strip preamble before sections.
      const h2 = text.search(/^##\s+\S/m);
      if (h2 > 0) {
        start = h2;
      }
    }
  }

  if (start > 0) {
    text = text.slice(start);
  }

  return text.trimStart();
}
