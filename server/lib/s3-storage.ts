import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
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
