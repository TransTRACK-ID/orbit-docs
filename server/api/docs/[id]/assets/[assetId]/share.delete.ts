import { defineEventHandler, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { loadDocAssetOr404, requireDocAssetAccess, toDocAssetDto } from "~/server/lib/doc-assets";

/** Disables the public link; the token is kept so re-enabling restores the same URL. */
export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));

  const updated = await getDb()
    .update(docAssets)
    .set({ shareEnabled: false, updatedAt: new Date() })
    .where(eq(docAssets.id, asset.id))
    .returning()
    .then((rows) => rows[0]!);

  return { data: toDocAssetDto(updated) };
});
