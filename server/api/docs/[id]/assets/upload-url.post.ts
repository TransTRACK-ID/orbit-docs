import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { requireDocAssetAccess } from "~/server/lib/doc-assets";
import {
  assertAllowedDocAssetType,
  buildDocAssetKey,
  createDocAssetUploadUrl,
  getDocAssetMaxBytes,
  normalizeMime,
} from "~/server/lib/s3-storage";

/** Step 1 of an attachment upload: reserve a row and hand out a presigned PUT URL. */
export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const body = await readBody<{ fileName?: string; contentType?: string; size?: number }>(event);

  const fileName = String(body?.fileName || "").trim().slice(0, 255);
  const contentType = normalizeMime(String(body?.contentType || ""));
  const size = Number(body?.size);

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "fileName is required" });
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "size must be a positive number" });
  }

  const kind = assertAllowedDocAssetType(contentType);
  const maxBytes = getDocAssetMaxBytes(kind);
  if (size > maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: "Payload Too Large",
      message: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit for ${kind === "pdf" ? "PDF" : "video"} attachments`,
    });
  }

  const assetId = crypto.randomUUID();
  const s3Key = buildDocAssetKey(doc.id, assetId);
  const uploadUrl = await createDocAssetUploadUrl(s3Key, contentType, size);

  const db = getDb();
  await db.insert(docAssets).values({
    id: assetId,
    docId: doc.id,
    kind,
    s3Key,
    mimeType: contentType,
    sizeBytes: size,
    fileName,
    title: fileName.replace(/\.[^.]+$/, ""),
    status: "pending",
  });

  return {
    data: {
      assetId,
      kind,
      uploadUrl,
      headers: { "Content-Type": contentType },
    },
  };
});
