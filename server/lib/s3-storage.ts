import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createError } from "h3";
import type { Readable } from "node:stream";
import { getS3Config, type S3Config } from "~/server/utils/runtime-env";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_LOGO_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "image/svg+xml",
]);

const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function assertValidReleaseId(releaseId: string): void {
  if (!isValidUuid(releaseId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid release ID",
    });
  }
}

export function assertValidAssetId(assetId: string): void {
  if (!isValidUuid(assetId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid asset ID",
    });
  }
}

export function buildReleaseAssetKey(releaseId: string, assetId: string): string {
  assertValidReleaseId(releaseId);
  assertValidAssetId(assetId);
  return `releases/${releaseId}/${assetId}`;
}

function detectImageMime(buffer: Buffer): string | null {
  for (const { mime, bytes } of IMAGE_SIGNATURES) {
    if (bytes.every((byte, index) => buffer[index] === byte)) {
      if (mime === "image/webp" && buffer.length >= 12) {
        const riffType = buffer.toString("ascii", 8, 12);
        if (riffType !== "WEBP") return null;
      }
      return mime;
    }
  }
  return null;
}

export function assertAllowedImageType(
  declaredMime: string,
  buffer: Buffer
): string {
  const normalized = declaredMime.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Unsupported image type: ${normalized || "unknown"}`,
    });
  }

  const detected = detectImageMime(buffer);
  if (!detected) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File does not match a supported image format",
    });
  }

  if (detected !== normalized) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Declared content type does not match file contents",
    });
  }

  return normalized;
}

function buildConfigKey(config: S3Config): string {
  return [
    config.bucket,
    config.region,
    config.accessKeyId,
    config.endpoint || "",
    config.forcePathStyle ? "1" : "0",
  ].join("|");
}

function getS3Client(): { client: S3Client; config: S3Config } {
  const config = getS3Config();
  if (!config) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "Object storage is not configured. Set S3_BUCKET, S3_REGION, and credentials.",
    });
  }

  const configKey = buildConfigKey(config);
  if (!cachedClient || cachedConfigKey !== configKey) {
    const clientConfig: S3ClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle;
    }

    cachedClient = new S3Client(clientConfig);
    cachedConfigKey = configKey;
  }

  return { client: cachedClient, config };
}

export async function uploadReleaseAsset(
  releaseId: string,
  buffer: Buffer,
  contentType: string
): Promise<{ assetId: string; key: string }> {
  assertValidReleaseId(releaseId);
  const safeContentType = assertAllowedImageType(contentType, buffer);

  const { client, config } = getS3Client();
  if (buffer.byteLength > config.uploadMaxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `Image exceeds maximum size of ${config.uploadMaxBytes} bytes`,
    });
  }

  const assetId = crypto.randomUUID();
  const key = buildReleaseAssetKey(releaseId, assetId);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: safeContentType,
      ContentLength: buffer.byteLength,
    })
  );

  return { assetId, key };
}

export interface ReleaseAssetStream {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

export async function getReleaseAsset(
  releaseId: string,
  assetId: string
): Promise<ReleaseAssetStream> {
  const key = buildReleaseAssetKey(releaseId, assetId);
  const { client, config } = getS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: "Asset not found",
      });
    }

    return {
      body: response.Body as Readable,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: "Asset not found",
      });
    }
    throw error;
  }
}

export function buildReleaseMediaProxyPath(releaseId: string, assetId: string): string {
  assertValidReleaseId(releaseId);
  assertValidAssetId(assetId);
  return `/api/public/releases/${releaseId}/media/${assetId}`;
}

export function buildLogoAssetKey(assetId: string): string {
  assertValidAssetId(assetId);
  return `brand/logos/${assetId}`;
}

function detectSvgMime(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trim();
  if (sample.startsWith("<svg")) return true;
  if (sample.startsWith("<?xml")) {
    return sample.includes("<svg");
  }
  return false;
}

export function assertAllowedLogoType(
  declaredMime: string,
  buffer: Buffer
): string {
  const normalized = declaredMime.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_LOGO_TYPES.has(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Unsupported logo type: ${normalized || "unknown"}`,
    });
  }

  if (normalized === "image/svg+xml") {
    if (!detectSvgMime(buffer)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "File does not match a supported SVG format",
      });
    }
    return normalized;
  }

  return assertAllowedImageType(normalized, buffer);
}

export async function uploadLogoAsset(
  buffer: Buffer,
  contentType: string
): Promise<{ assetId: string; key: string }> {
  const safeContentType = assertAllowedLogoType(contentType, buffer);

  const { client, config } = getS3Client();
  if (buffer.byteLength > config.uploadMaxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `Logo exceeds maximum size of ${config.uploadMaxBytes} bytes`,
    });
  }

  const assetId = crypto.randomUUID();
  const key = buildLogoAssetKey(assetId);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: safeContentType,
      ContentLength: buffer.byteLength,
    })
  );

  return { assetId, key };
}

export interface LogoAssetStream {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

export async function getLogoAsset(assetId: string): Promise<LogoAssetStream> {
  const key = buildLogoAssetKey(assetId);
  const { client, config } = getS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: "Logo not found",
      });
    }

    return {
      body: response.Body as Readable,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: "Logo not found",
      });
    }
    throw error;
  }
}

export function buildLogoProxyPath(assetId: string): string {
  assertValidAssetId(assetId);
  return `/api/public/brand/logos/${assetId}`;
}

// ── Doc attachments (video / PDF), uploaded directly to S3 via presigned URLs ──

export type DocAssetKind = "video" | "pdf";

const DOC_ASSET_TYPES: Record<DocAssetKind, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
};

const PRESIGNED_PUT_TTL_SECONDS = 15 * 60;
const PRESIGNED_GET_TTL_SECONDS = 10 * 60;

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name]?.trim() || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDocAssetMaxBytes(kind: DocAssetKind): number {
  return kind === "video"
    ? readPositiveIntEnv("DOC_VIDEO_MAX_BYTES", 500 * 1024 * 1024)
    : readPositiveIntEnv("DOC_PDF_MAX_BYTES", 50 * 1024 * 1024);
}

export function normalizeMime(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

/** Returns the asset kind for an allowed MIME type, or throws 400. */
export function assertAllowedDocAssetType(declaredMime: string): DocAssetKind {
  const normalized = normalizeMime(declaredMime);
  for (const [kind, types] of Object.entries(DOC_ASSET_TYPES) as Array<[DocAssetKind, Set<string>]>) {
    if (types.has(normalized)) return kind;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Bad Request",
    message: `Unsupported file type: ${normalized || "unknown"}. Use PDF, MP4, WebM, or MOV.`,
  });
}

/** Checks the leading bytes of an uploaded object against its declared kind. */
export function matchesDocAssetSignature(kind: DocAssetKind, head: Buffer): boolean {
  if (kind === "pdf") {
    return head.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  const isIsoMedia = head.length >= 8 && head.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm = head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  return isIsoMedia || isWebm;
}

export function buildDocAssetKey(docId: string, assetId: string): string {
  if (!docId || /[^a-zA-Z0-9-]/.test(docId)) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Invalid doc ID" });
  }
  assertValidAssetId(assetId);
  return `docs/${docId}/${assetId}`;
}

export function buildDocImageKey(docId: string, imageId: string): string {
  return buildDocAssetKey(docId, imageId).replace(/\/([^/]+)$/, "/images/$1");
}

/** Stores an inline doc image (validated like release images) and returns its id. */
export async function uploadDocImage(docId: string, buffer: Buffer, contentType: string): Promise<string> {
  const safeContentType = assertAllowedImageType(contentType, buffer);
  const { client, config } = getS3Client();
  if (buffer.byteLength > config.uploadMaxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `Image exceeds maximum size of ${config.uploadMaxBytes} bytes`,
    });
  }
  const imageId = crypto.randomUUID();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: buildDocImageKey(docId, imageId),
      Body: buffer,
      ContentType: safeContentType,
      ContentLength: buffer.byteLength,
    }),
  );
  return imageId;
}

export async function createDocImageDownloadUrl(key: string): Promise<string> {
  const { client, config } = getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: PRESIGNED_GET_TTL_SECONDS,
  });
}

export async function createDocAssetUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const { client, config } = getS3Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: PRESIGNED_PUT_TTL_SECONDS },
  );
}

export async function createDocAssetDownloadUrl(
  key: string,
  options: { fileName: string; contentType: string; download?: boolean },
): Promise<string> {
  const { client, config } = getS3Client();
  const safeName = options.fileName.replace(/["\\\r\n]/g, "_");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: `${options.download ? "attachment" : "inline"}; filename="${safeName}"`,
    }),
    { expiresIn: PRESIGNED_GET_TTL_SECONDS },
  );
}

function isNotFoundError(error: unknown): boolean {
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err.name === "NoSuchKey" || err.name === "NotFound" || err.$metadata?.httpStatusCode === 404;
}

/** Size, type, and first bytes of an uploaded object; null when the object does not exist. */
export async function inspectDocAsset(
  key: string,
): Promise<{ contentLength: number; contentType: string; head: Buffer } | null> {
  const { client, config } = getS3Client();
  try {
    const meta = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    const response = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: "bytes=0-15" }),
    );
    const head = response.Body
      ? Buffer.from(await response.Body.transformToByteArray())
      : Buffer.alloc(0);
    return {
      contentLength: meta.ContentLength ?? 0,
      contentType: meta.ContentType || "application/octet-stream",
      head,
    };
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function readDocAssetBuffer(key: string): Promise<Buffer> {
  const { client, config } = getS3Client();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!response.Body) {
      throw createError({ statusCode: 404, statusMessage: "Not Found", message: "File not found" });
    }
    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      throw createError({ statusCode: 404, statusMessage: "Not Found", message: "File not found" });
    }
    throw error;
  }
}

export async function deleteDocAssetObject(key: string): Promise<void> {
  const { client, config } = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
