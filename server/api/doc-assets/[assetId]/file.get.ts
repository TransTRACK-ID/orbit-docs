import { defineEventHandler, getQuery, getRouterParam } from "h3";
import { loadDocAssetForFile } from "~/server/lib/doc-assets";
import { streamDocAssetFile } from "~/server/lib/doc-asset-stream";

/** Streams a doc attachment through Orbit so PDF iframes and video tags stay same-origin (CSP-safe). */
export default defineEventHandler(async (event) => {
  const asset = await loadDocAssetForFile(event, getRouterParam(event, "assetId"));
  return streamDocAssetFile(event, asset.s3Key, {
    fileName: asset.fileName,
    contentType: asset.mimeType,
    download: getQuery(event).download === "1",
  });
});
