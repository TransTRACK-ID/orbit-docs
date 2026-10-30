import { defineEventHandler, getQuery, getRouterParam, sendRedirect, setResponseHeader } from "h3";
import { loadSharedDocAsset } from "~/server/lib/doc-assets";
import { createDocAssetDownloadUrl } from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  const asset = await loadSharedDocAsset(event, getRouterParam(event, "token"));

  const url = await createDocAssetDownloadUrl(asset.s3Key, {
    fileName: asset.fileName,
    contentType: asset.mimeType,
    download: getQuery(event).download === "1",
  });
  setResponseHeader(event, "Cache-Control", "no-store");
  return sendRedirect(event, url, 302);
});
