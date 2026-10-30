import { createError, defineEventHandler, readMultipartFormData } from "h3";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { requireDocAssetAccess, toDocAssetDto } from "~/server/lib/doc-assets";
import {
  assertAllowedDocAssetType,
  buildDocAssetKey,
  getDocAssetMaxBytes,
  normalizeMime,
  uploadDocAssetObject,
} from "~/server/lib/s3-storage";

/** Upload a PDF or video through Orbit (same pattern as doc images). Avoids bucket CORS on browser PUT. */
export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");

  const form = await readMultipartFormData(event);
  const filePart = form?.find((part) => part.name === "file" && part.data);
  if (!filePart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing file field in multipart upload",
    });
  }

  const buffer = Buffer.from(filePart.data);
  const contentType = normalizeMime(filePart.type || "application/octet-stream");
  const kind = assertAllowedDocAssetType(contentType);
  const maxBytes = getDocAssetMaxBytes(kind);
  if (buffer.byteLength > maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit for ${kind === "pdf" ? "PDF" : "video"} attachments`,
    });
  }

  const fileName = String(filePart.filename || "attachment").trim().slice(0, 255) || "attachment";
  const assetId = crypto.randomUUID();

  await uploadDocAssetObject(doc.id, assetId, buffer, contentType, kind);

  const row = await getDb()
    .insert(docAssets)
    .values({
      id: assetId,
      docId: doc.id,
      kind,
      s3Key: buildDocAssetKey(doc.id, assetId),
      mimeType: contentType,
      sizeBytes: buffer.byteLength,
      fileName,
      title: fileName.replace(/\.[^.]+$/, ""),
      status: "ready",
    })
    .returning()
    .then((rows) => rows[0]!);

  return { data: toDocAssetDto(row) };
});
