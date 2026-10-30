/**
 * Markdown form of an uploaded doc video with its transcript:
 *
 *   :::video <assetId> <title>
 *   [00:00-00:42] Intro and goals
 *   [00:42-01:30] Walkthrough of the login flow
 *   :::
 *
 * Transcript lines live in the doc body so keyword search, grep tools, and chunk
 * embeddings all see them with their timestamps.
 */

export interface TranscriptSegment {
  /** Seconds from video start. */
  start: number;
  /** Seconds from video start; null when unknown. */
  end: number | null;
  text: string;
}

export interface VideoBlockData {
  assetId: string;
  title: string;
  segments: TranscriptSegment[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_RE = /^:::video\s+(\S+)(?:\s+(.*))?$/;
const SEGMENT_RE = /^\[(\d{1,2}(?::\d{1,2}){1,2})(?:\s*-\s*(\d{1,2}(?::\d{1,2}){1,2}))?\]\s*(.*)$/;

export function isVideoBlockOpenLine(line: string): boolean {
  return OPEN_RE.test(line.trim());
}

export function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Parses `mm:ss` or `h:mm:ss`; returns null for anything else. */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

function singleLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}

export function serializeVideoBlock(data: VideoBlockData): string {
  const lines = [`:::video ${data.assetId} ${singleLine(data.title)}`.trimEnd()];
  for (const segment of data.segments) {
    const text = singleLine(segment.text);
    if (!text) continue;
    const range =
      segment.end != null && segment.end > segment.start
        ? `${formatTimestamp(segment.start)}-${formatTimestamp(segment.end)}`
        : formatTimestamp(segment.start);
    lines.push(`[${range}] ${text}`);
  }
  lines.push(":::");
  return lines.join("\n");
}

/**
 * Parses a video block starting at `lines[start]`.
 * Returns null when the line is not a valid opener; otherwise the data and the index after `:::`.
 */
export function parseVideoBlock(
  lines: string[],
  start: number,
): { data: VideoBlockData; next: number } | null {
  const open = lines[start]?.trim().match(OPEN_RE);
  if (!open || !UUID_RE.test(open[1]!)) return null;

  const segments: TranscriptSegment[] = [];
  let i = start + 1;
  while (i < lines.length && lines[i]!.trim() !== ":::") {
    const match = lines[i]!.trim().match(SEGMENT_RE);
    if (match) {
      const startSec = parseTimestamp(match[1]!);
      const endSec = match[2] ? parseTimestamp(match[2]) : null;
      if (startSec != null && match[3]!.trim()) {
        segments.push({ start: startSec, end: endSec, text: match[3]!.trim() });
      }
    }
    i++;
  }

  return {
    data: { assetId: open[1]!, title: (open[2] || "").trim(), segments },
    next: i < lines.length ? i + 1 : i,
  };
}

export function videoFileUrl(assetId: string): string {
  return `/api/doc-assets/${assetId}/file`;
}
