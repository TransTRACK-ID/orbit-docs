import { defineEventHandler, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { loadDocAssetOr404, requireDocAssetAccess } from "~/server/lib/doc-assets";
import { deleteDocAssetObject } from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));

  await deleteDocAssetObject(asset.s3Key);
  await getDb().delete(docAssets).where(eq(docAssets.id, asset.id));

  return { data: { id: asset.id, deleted: true } };
});
