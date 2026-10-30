import type { TranscriptSegment } from "~/utils/video-block";

/** `00:01:02,500` (SRT) or `01:02.500` / `00:01:02.500` (VTT) → seconds. */
function parseCueTime(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h || 0) * 3600 + Number(m) * 60 + Number(s) + (ms ? Number(ms.padEnd(3, "0")) / 1000 : 0);
}

function stripCueMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses SRT or WebVTT subtitle text into transcript segments (whole seconds). */
export function parseSubtitles(input: string): TranscriptSegment[] {
  const blocks = input.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").split(/\n{2,}/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const [rawStart, rawEndWithSettings] = lines[timingIndex]!.split("-->");
    const start = parseCueTime(rawStart || "");
    const end = parseCueTime((rawEndWithSettings || "").trim().split(/\s+/)[0] || "");
    const text = stripCueMarkup(lines.slice(timingIndex + 1).join(" "));
    if (start == null || !text) continue;

    segments.push({
      start: Math.floor(start),
      end: end != null ? Math.ceil(end) : null,
      text,
    });
  }

  return segments.sort((a, b) => a.start - b.start);
}
