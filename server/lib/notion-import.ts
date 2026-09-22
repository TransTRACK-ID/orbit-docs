import { unzipSync } from "fflate";
import { createError } from "h3";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, posix } from "node:path";

export const IMPORT_CHUNK_SIZE = 4 * 1024 * 1024;
export const IMPORT_MAX_ZIP_BYTES = 200 * 1024 * 1024;
const IMPORT_MAX_ENTRIES = 5000;
const IMPORT_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const SESSION_ROOT = join(tmpdir(), "orbit-notion-import");
const NOTION_HASH_SUFFIX_RE = /\s+[0-9a-f]{32}$/i;
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^<>\s)]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMG_RE = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi;

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export interface ImportSessionMeta {
  uploadId: string;
  userId: string;
  fileName: string;
  totalSize: number;
  totalChunks: number;
  appId: string;
  versionId: string;
  heroTitle: string;
  status: "uploading" | "ready";
  createdAt: number;
}

export interface ZipMarkdownEntry {
  path: string;
  size: number;
}

export function assetMimeForPath(path: string): string | null {
  return IMAGE_MIME_BY_EXT[extname(path).toLowerCase()] || null;
}

// ── Session storage ─────────────────────────────────────────────

const UPLOAD_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionDir(uploadId: string): string {
  if (!UPLOAD_ID_RE.test(uploadId)) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Upload session not found or expired. Start the import again.",
    });
  }
  return join(SESSION_ROOT, uploadId);
}

export async function saveImportSessionMeta(
  dir: string,
  meta: ImportSessionMeta
): Promise<void> {
  await fs.writeFile(join(dir, "meta.json"), JSON.stringify(meta), "utf-8");
}

export async function createImportSession(
  meta: ImportSessionMeta
): Promise<ImportSessionMeta> {
  await sweepExpiredSessions();
  const dir = sessionDir(meta.uploadId);
  await fs.mkdir(join(dir, "chunks"), { recursive: true });
  await saveImportSessionMeta(dir, meta);
  return meta;
}

export async function readImportSession(
  uploadId: string,
  userId: string
): Promise<{ dir: string; meta: ImportSessionMeta }> {
  const dir = sessionDir(uploadId);
  let meta: ImportSessionMeta;
  try {
    meta = JSON.parse(await fs.readFile(join(dir, "meta.json"), "utf-8"));
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Upload session not found or expired. Start the import again.",
    });
  }

  if (meta.userId !== userId || meta.uploadId !== uploadId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Upload session not found or expired. Start the import again.",
    });
  }

  if (Date.now() - meta.createdAt > SESSION_TTL_MS) {
    await cleanupImportSession(uploadId);
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Upload session expired. Start the import again.",
    });
  }

  return { dir, meta };
}

export async function storeImportChunk(
  dir: string,
  meta: ImportSessionMeta,
  index: number,
  data: Buffer
): Promise<void> {
  if (!Number.isInteger(index) || index < 0 || index >= meta.totalChunks) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Chunk index ${index} is out of range`,
    });
  }

  const expected =
    index === meta.totalChunks - 1
      ? meta.totalSize - index * IMPORT_CHUNK_SIZE
      : IMPORT_CHUNK_SIZE;

  if (data.byteLength !== expected) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Chunk ${index} has ${data.byteLength} bytes, expected ${expected}`,
    });
  }

  await fs.writeFile(join(dir, "chunks", `${index}.part`), data);
}

export async function listReceivedChunks(dir: string): Promise<number[]> {
  try {
    const files = await fs.readdir(join(dir, "chunks"));
    return files
      .filter((name) => /^\d+\.part$/.test(name))
      .map((name) => Number.parseInt(name, 10))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function stitchImportArchive(
  dir: string,
  meta: ImportSessionMeta
): Promise<string> {
  const received = await listReceivedChunks(dir);
  if (received.length !== meta.totalChunks) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: `Upload incomplete: ${received.length} of ${meta.totalChunks} chunks received`,
      data: { received },
    });
  }

  const archivePath = join(dir, "archive.zip");
  const handle = await fs.open(archivePath, "w");
  try {
    for (let i = 0; i < meta.totalChunks; i++) {
      const part = await fs.readFile(join(dir, "chunks", `${i}.part`));
      await handle.write(part);
    }
  } finally {
    await handle.close();
  }

  const stat = await fs.stat(archivePath);
  if (stat.size !== meta.totalSize) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Uploaded archive is corrupt. Start the import again.",
    });
  }

  return archivePath;
}

export async function cleanupImportSession(uploadId: string): Promise<void> {
  await fs.rm(sessionDir(uploadId), { recursive: true, force: true });
}

async function sweepExpiredSessions(): Promise<void> {
  let names: string[] = [];
  try {
    names = await fs.readdir(SESSION_ROOT);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    try {
      const stat = await fs.stat(join(SESSION_ROOT, name, "meta.json"));
      if (now - stat.mtimeMs > SESSION_TTL_MS) {
        await fs.rm(join(SESSION_ROOT, name), { recursive: true, force: true });
      }
    } catch {
      // best-effort sweep
    }
  }
}

// ── Zip extraction ──────────────────────────────────────────────

export function sanitizeZipPath(name: string): string | null {
  const normalized = name.replace(/\\/g, "/");
  if (!normalized || normalized.endsWith("/")) return null;
  const path = posix.normalize(normalized);
  if (
    path.startsWith("/") ||
    path === ".." ||
    path.startsWith("../") ||
    path.includes("/../")
  ) {
    return null;
  }
  if (path.startsWith("__MACOSX/") || path.includes("/__MACOSX/")) return null;
  if (basename(path) === ".DS_Store") return null;
  return path;
}

export function unzipImportArchive(buffer: Buffer): Map<string, Uint8Array> {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(new Uint8Array(buffer));
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File is not a valid ZIP archive",
    });
  }

  const entries = new Map<string, Uint8Array>();
  let totalBytes = 0;
  for (const [name, data] of Object.entries(raw)) {
    const path = sanitizeZipPath(name);
    if (!path) continue;
    if (entries.size >= IMPORT_MAX_ENTRIES) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: `Archive contains more than ${IMPORT_MAX_ENTRIES} files`,
      });
    }
    totalBytes += data.byteLength;
    if (totalBytes > IMPORT_MAX_UNCOMPRESSED_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: "Payload Too Large",
        message: "Archive contents are too large to import",
      });
    }
    entries.set(path, data);
  }
  return entries;
}

export function listMarkdownEntries(
  entries: Map<string, Uint8Array>
): ZipMarkdownEntry[] {
  return [...entries.keys()]
    .filter((path) => path.toLowerCase().endsWith(".md"))
    .map((path) => ({ path, size: entries.get(path)!.byteLength }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ── Markdown helpers ────────────────────────────────────────────

export function deriveHeroTitle(mdPath: string, mdText: string): string {
  const fromName = basename(mdPath)
    .replace(/\.md$/i, "")
    .replace(NOTION_HASH_SUFFIX_RE, "")
    .trim();
  if (fromName && !/^[0-9a-f]{32}$/i.test(fromName)) return fromName;
  const heading = mdText.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || "Imported release";
}

function isExternalRef(ref: string): boolean {
  return /^(https?:|data:|blob:|\/)/i.test(ref);
}

function decodeRef(ref: string): string {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

/**
 * All image references found in the markdown that point at a local file
 * (inline `![alt](src)` and `<img src>` syntax; external URLs excluded).
 */
export function listLocalImageRefs(mdText: string): string[] {
  const refs = new Set<string>();
  let match: RegExpExecArray | null;

  MD_IMAGE_RE.lastIndex = 0;
  while ((match = MD_IMAGE_RE.exec(mdText)) !== null) {
    if (!isExternalRef(match[1]!)) refs.add(match[1]!);
  }
  HTML_IMG_RE.lastIndex = 0;
  while ((match = HTML_IMG_RE.exec(mdText)) !== null) {
    if (!isExternalRef(match[2]!)) refs.add(match[2]!);
  }

  return [...refs];
}

/**
 * Maps each raw markdown image reference to the zip entry it points at.
 * Resolution order: path relative to the markdown file, path from the
 * archive root, then a unique basename match.
 */
export function collectMarkdownAssetRefs(
  entries: Map<string, Uint8Array>,
  mdPath: string,
  mdText: string
): Map<string, string> {
  const mdDir = posix.dirname(mdPath);
  const refs = new Map<string, string>();

  for (const rawRef of listLocalImageRefs(mdText)) {
    const decoded = decodeRef(rawRef).replace(/^\.\//, "");
    const normalized = posix.normalize(decoded);
    const candidates =
      mdDir === "." ? [normalized] : [posix.join(mdDir, decoded), normalized];

    let hit = candidates.find((candidate) => entries.has(candidate));
    if (!hit) {
      const base = basename(normalized);
      const byName = [...entries.keys()].filter((p) => basename(p) === base);
      if (byName.length === 1) hit = byName[0];
    }
    if (hit) refs.set(rawRef, hit);
  }

  return refs;
}

export function rewriteMarkdownAssets(
  mdText: string,
  replacements: Map<string, string>
): string {
  if (replacements.size === 0) return mdText;

  MD_IMAGE_RE.lastIndex = 0;
  let out = mdText.replace(MD_IMAGE_RE, (whole, ref: string) => {
    const next = replacements.get(ref);
    return next ? whole.replace(ref, next) : whole;
  });

  HTML_IMG_RE.lastIndex = 0;
  out = out.replace(HTML_IMG_RE, (_whole, pre: string, ref: string, post: string) => {
    const next = replacements.get(ref);
    return next ? `${pre}${next}${post}` : `${pre}${ref}${post}`;
  });

  return out;
}
