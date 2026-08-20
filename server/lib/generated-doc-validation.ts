/**
 * Detect incomplete / truncated agent output for generated markdown documents.
 */

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
  if (!options?.isMergedUpdate && looksIncompleteDocUpdate(trimmed, existingContent ?? null)) {
    return { valid: false, reason: "updated document is much shorter than the existing version" };
  }
  return { valid: true };
}
