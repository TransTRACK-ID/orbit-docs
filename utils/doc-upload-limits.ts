/** Defaults match server enforcement in `server/lib/s3-storage.ts` (overridable via env). */
export const DEFAULT_DOC_PDF_MAX_BYTES = 50 * 1024 * 1024;
/** Same cap as typical `client_max_body_size` (e.g. nginx 50M) for server-side multipart uploads. */
export const DEFAULT_DOC_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const DEFAULT_DOC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type DocAttachmentKind = "pdf" | "video";

const PDF_MIME = new Set(["application/pdf"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function parsePositiveInt(value: string | undefined | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDocPdfMaxBytes(envValue?: string): number {
  return parsePositiveInt(envValue, DEFAULT_DOC_PDF_MAX_BYTES);
}

export function getDocVideoMaxBytes(envValue?: string): number {
  return parsePositiveInt(envValue, DEFAULT_DOC_VIDEO_MAX_BYTES);
}

export function getDocImageMaxBytes(envValue?: string): number {
  return parsePositiveInt(envValue, DEFAULT_DOC_IMAGE_MAX_BYTES);
}

export function formatUploadLimitMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

export function docAttachmentKindForMime(mime: string): DocAttachmentKind | null {
  const normalized = mime.split(";")[0]!.trim().toLowerCase();
  if (PDF_MIME.has(normalized)) return "pdf";
  if (VIDEO_MIME.has(normalized)) return "video";
  return null;
}

export function docAttachmentKindForFile(file: File): DocAttachmentKind | null {
  return docAttachmentKindForMime(file.type || "");
}

export function validateDocAttachmentSize(
  file: File,
  pdfMaxBytes: number,
  videoMaxBytes: number,
): string | null {
  const kind = docAttachmentKindForFile(file);
  if (!kind) return null;
  const maxBytes = kind === "pdf" ? pdfMaxBytes : videoMaxBytes;
  if (file.size <= maxBytes) return null;
  return `File exceeds the ${formatUploadLimitMb(maxBytes)} limit for ${kind === "pdf" ? "PDF" : "video"} attachments`;
}

export function validateDocImageSize(file: File, maxBytes: number): string | null {
  if (file.size <= maxBytes) return null;
  return `Image exceeds the ${formatUploadLimitMb(maxBytes)} limit`;
}
