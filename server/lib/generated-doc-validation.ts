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
];

/** Agent reasoning or unprocessed JSON that was saved instead of markdown. */
export function looksLikeRawAgentOutput(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (AGENT_PREAMBLE_PATTERNS.some((re) => re.test(trimmed))) {
    return true;
  }

  // Detect raw JSON section-update payloads — either at the start of the
  // content or embedded after agent preamble text (e.g. "I'll locate...{"sections":...}").
  if (trimmed.includes('"sections"') && trimmed.includes('"heading"') && trimmed.includes('"content"')) {
    const jsonStart = trimmed.indexOf("{");
    if (jsonStart !== -1) {
      try {
        extractDocSectionUpdateJson(trimmed);
        return true;
      } catch {
        // JSON may be truncated — still flag if preamble precedes it.
        if (jsonStart > 0) return true;
      }
    }
  }

  return false;
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
  if (!options?.isMergedUpdate && looksIncompleteDocUpdate(trimmed, existingContent ?? null)) {
    return { valid: false, reason: "updated document is much shorter than the existing version" };
  }
  return { valid: true };
}
