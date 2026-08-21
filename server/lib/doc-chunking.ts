import { splitMarkdownSections } from "~/server/lib/doc-section-merge";

export const INDEXABLE_DOC_TYPES = ["feature", "sdd", "wiki"] as const;
export type IndexableDocType = (typeof INDEXABLE_DOC_TYPES)[number];

export function indexableDocTypesForCategory(
  category?: "product" | "knowledge",
): IndexableDocType[] {
  if (category === "knowledge") return ["feature"];
  if (category === "product") return ["sdd", "wiki"];
  return [...INDEXABLE_DOC_TYPES];
}

export interface DocChunkInput {
  heading: string;
  chunkIndex: number;
  content: string;
}

function getMaxChunkChars(): number {
  const raw = process.env.DOC_CHUNK_MAX_CHARS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 500 ? parsed : 6000;
}

/** Split oversized text on paragraph boundaries, then lines as fallback. */
export function secondarySplitContent(content: string, maxChars: number): string[] {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length <= maxChars) return trimmed ? [trimmed] : [];

  const parts: string[] = [];
  const paragraphs = trimmed.split(/\n\n+/);
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) parts.push(buffer.trim());
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }

    flush();

    if (paragraph.length <= maxChars) {
      buffer = paragraph;
      continue;
    }

    const lines = paragraph.split("\n");
    for (const line of lines) {
      const lineCandidate = buffer ? `${buffer}\n${line}` : line;
      if (lineCandidate.length <= maxChars) {
        buffer = lineCandidate;
        continue;
      }
      flush();
      if (line.length <= maxChars) {
        buffer = line;
      } else {
        for (let i = 0; i < line.length; i += maxChars) {
          parts.push(line.slice(i, i + maxChars));
        }
      }
    }
  }

  flush();
  return parts.length > 0 ? parts : [trimmed.slice(0, maxChars)];
}

export function isIndexableDocType(docType: string | null | undefined): docType is IndexableDocType {
  return Boolean(docType && INDEXABLE_DOC_TYPES.includes(docType as IndexableDocType));
}

interface MarkdownSectionSlice {
  headingLine: string;
  raw: string;
}

const WIKI_HEADING_LEVELS = new Set([1, 2, 3]);

/** Split wiki pages on #, ##, and ### headings (Open Notebook-style). */
export function splitWikiMarkdownSections(doc: string): MarkdownSectionSlice[] {
  const lines = doc.split("\n");
  const sections: MarkdownSectionSlice[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!match || !WIKI_HEADING_LEVELS.has(match[1].length)) {
      i++;
      continue;
    }

    const headingLine = lines[i];
    const start = i;
    i++;

    while (i < lines.length) {
      const next = lines[i].match(/^(#{1,6})\s+/);
      if (next && WIKI_HEADING_LEVELS.has(next[1].length)) break;
      i++;
    }

    sections.push({
      headingLine,
      raw: lines.slice(start, i).join("\n"),
    });
  }

  return sections;
}

function sectionsForDocType(content: string, docType?: string | null): MarkdownSectionSlice[] {
  if (docType === "wiki") {
    return splitWikiMarkdownSections(content);
  }

  return splitMarkdownSections(content).map((section) => ({
    headingLine: section.headingLine,
    raw: section.raw,
  }));
}

/**
 * Split markdown into embeddable chunks.
 * Product docs (SDD): ## headings. Wiki pages: #, ##, ### headings.
 * Oversized sections are split further via paragraph/line boundaries.
 */
export function chunkMarkdownForEmbedding(
  content: string,
  docType?: string | null,
): DocChunkInput[] {
  const maxChars = getMaxChunkChars();
  const sections = sectionsForDocType(content, docType);
  const chunks: DocChunkInput[] = [];
  let chunkIndex = 0;

  if (sections.length === 0) {
    const preamble = content.trim();
    if (!preamble) return [];
    for (const part of secondarySplitContent(preamble, maxChars)) {
      chunks.push({
        heading: "(document)",
        chunkIndex: chunkIndex++,
        content: part,
      });
    }
    return chunks;
  }

  for (const section of sections) {
    const parts = secondarySplitContent(section.raw, maxChars);
    for (const part of parts) {
      chunks.push({
        heading: section.headingLine.replace(/^#+\s*/, "").trim() || section.headingLine,
        chunkIndex: chunkIndex++,
        content: part,
      });
    }
  }

  return chunks;
}
