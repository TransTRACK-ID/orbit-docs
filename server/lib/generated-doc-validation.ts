/**
 * Detect incomplete / truncated agent output for generated markdown documents.
 */

import { extractDocSectionUpdateJson } from "./doc-section-merge";

const TRUNCATION_MARKERS: RegExp[] = [
  /\[\.\.\./i,
  /\bfull\s+\d+[- ]line/i,
  /response length limit/i,
  /rather than repeated here/i,
  /open that file for the entire/i,
  /complete markdown is in/i,
  /truncated due to/i,
  /\[truncated\]/i,
  /omitted for brevity/i,
  /content omitted/i,
  /see the file at/i,
  /\.\.\.\s*full\b/i,
];

const AGENT_PREAMBLE_PATTERNS: RegExp[] = [
  /^I['']ll (read|explore|analyze|search|start|locate|find|check|begin|review)/im,
  /^Searching for/im,
  /^Let me (read|explore|analyze|search|check|look|start|try|review)/im,
  /^Analyzing (the|all|your|this)/im,
  /^(Product-root|No product-root|Product root|No product root)/im,
  /^emitting JSON/im,
  /^I need to (read|explore|analyze|search|check|find|look|review)/im,
  /^I will (read|explore|analyze|search|check|find|look|review|locate)/im,
  /^I'll (patch|update|produce|generate|create|write|draft|build)/im,
  /^Looking (at|for|through)/im,
  /^Checking (the|for|if)/im,
  /^Reading (the|from|existing)/im,
  /^Now (I|let|reading|analyzing|searching|checking|looking|producing|emitting)/im,
  /^(Unable to|Cannot|Can not) (perform|update|generate|find|read|create|produce)/im,
  /^I (can['']t|cannot) (produce|find|locate|generate|create|update|read)/im,
  /^I could not (find|locate|read|update|generate)/im,
];

/** Agent reasoning or unprocessed JSON that was saved instead of markdown. */
export function looksLikeRawAgentOutput(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (AGENT_PREAMBLE_PATTERNS.some((re) => re.test(trimmed))) {
    return true;
  }

  // Detect raw JSON section-update or error payloads — either as standalone JSON
  // (e.g. {"sections":[], ...}) or embedded after preamble text.
  if (
    trimmed.startsWith("{") ||
    trimmed.includes('"sections"') ||
    trimmed.includes('"revisionSummary"') ||
    (trimmed.includes('"heading"') && trimmed.includes('"content"'))
  ) {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd >= jsonStart) {
      try {
        const candidate = trimmed.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(candidate);
        if (
          parsed &&
          typeof parsed === "object" &&
          ("sections" in parsed || "revisionSummary" in parsed || "error" in parsed)
        ) {
          return true;
        }
      } catch {
        if (trimmed.includes('"sections"') || trimmed.includes('"revisionSummary"')) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check whether content is a valid, usable markdown document (not error JSON,
 * not raw agent reasoning, not empty, and containing markdown headings).
 */
export function isValidExistingDoc(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (trimmed.length < 20) return false;
  if (looksTruncatedDocOutput(trimmed)) return false;
  if (looksLikeRawAgentOutput(trimmed)) return false;
  if (!/^#{1,3}\s+\S/m.test(trimmed)) return false;
  return true;
}

export function looksTruncatedDocOutput(content: string): boolean {
  if (!content.trim()) return true;
  return TRUNCATION_MARKERS.some((re) => re.test(content));
}

/**
 * Heuristic: an update that shrinks a large existing doc suspiciously is likely truncated.
 */
export function looksIncompleteDocUpdate(
  newContent: string,
  existingContent: string | null
): boolean {

  if (!existingContent?.trim()) return false;

  const existingLen = existingContent.trim().length;
  const newLen = newContent.trim().length;

  if (existingLen < 4000) return false;

  // Major shrink without truncation markers still possible but rare — use a low ratio.
  if (newLen < existingLen * 0.35) return true;

  return false;
}

export function validateGeneratedDocContent(
  content: string,
  existingContent?: string | null,
  options?: { isMergedUpdate?: boolean }
): { valid: boolean; reason?: string } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { valid: false, reason: "empty document" };
  }
  if (looksTruncatedDocOutput(trimmed)) {
    return { valid: false, reason: "truncated or placeholder markers in output" };
  }
  if (looksLikeRawAgentOutput(trimmed)) {
    return { valid: false, reason: "raw agent reasoning or JSON in output" };
  }
  if (!/^#{1,3}\s+\S/m.test(trimmed)) {
    return { valid: false, reason: "document has no markdown headings" };
  }
  if (!options?.isMergedUpdate && looksIncompleteDocUpdate(trimmed, existingContent ?? null)) {
    return { valid: false, reason: "updated document is much shorter than the existing version" };
  }
  return { valid: true };
}
