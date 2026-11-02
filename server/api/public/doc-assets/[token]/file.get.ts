import { defineEventHandler, getQuery, getRouterParam } from "h3";
import { loadSharedDocAsset } from "~/server/lib/doc-assets";
import { streamDocAssetFile } from "~/server/lib/doc-asset-stream";

export default defineEventHandler(async (event) => {
  const asset = await loadSharedDocAsset(event, getRouterParam(event, "token"));
  return streamDocAssetFile(event, asset.s3Key, {
    fileName: asset.fileName,
    contentType: asset.mimeType,
    download: getQuery(event).download === "1",
  });
});
