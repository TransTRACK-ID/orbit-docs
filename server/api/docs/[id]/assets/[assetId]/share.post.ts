import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import {
  createShareToken,
  loadDocAssetOr404,
  requireDocAssetAccess,
  toDocAssetDto,
} from "~/server/lib/doc-assets";

export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));

  if (asset.kind !== "pdf" || asset.status !== "ready") {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "Only uploaded PDFs can be shared" });
  }

  const updated = await getDb()
    .update(docAssets)
    .set({
      shareToken: asset.shareToken || createShareToken(),
      shareEnabled: true,
      sharedAt: asset.sharedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(docAssets.id, asset.id))
    .returning()
    .then((rows) => rows[0]!);

  return { data: toDocAssetDto(updated) };
});
