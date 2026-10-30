import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { loadDocAssetOr404, requireDocAssetAccess, toDocAssetDto } from "~/server/lib/doc-assets";
import {
  deleteDocAssetObject,
  getDocAssetMaxBytes,
  inspectDocAsset,
  matchesDocAssetSignature,
} from "~/server/lib/s3-storage";

/** Step 2 of an attachment upload: verify the object the browser PUT to S3, then mark it ready. */
export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));
  const db = getDb();

  if (asset.status === "ready") {
    return { data: toDocAssetDto(asset) };
  }

  const object = await inspectDocAsset(asset.s3Key);
  if (!object) {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "Upload has not finished yet" });
  }

  const rejected =
    object.contentLength > getDocAssetMaxBytes(asset.kind) ||
    !matchesDocAssetSignature(asset.kind, object.head);
  if (rejected) {
    await deleteDocAssetObject(asset.s3Key);
    await db.delete(docAssets).where(eq(docAssets.id, asset.id));
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File contents do not match a supported PDF or video format",
    });
  }

  const updated = await db
    .update(docAssets)
    .set({ status: "ready", sizeBytes: object.contentLength, updatedAt: new Date() })
    .where(eq(docAssets.id, asset.id))
    .returning()
    .then((rows) => rows[0]!);

  return { data: toDocAssetDto(updated) };
});
