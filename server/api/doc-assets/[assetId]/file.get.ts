import { defineEventHandler, getQuery, getRouterParam, sendRedirect, setResponseHeader } from "h3";
import { loadDocAssetForFile } from "~/server/lib/doc-assets";
import { createDocAssetDownloadUrl } from "~/server/lib/s3-storage";

/**
 * Redirects to a short-lived presigned URL so S3 serves Range requests (video seeking) directly.
 * One URL works in the editor and on public pages: published docs are readable without a role.
 */
export default defineEventHandler(async (event) => {
  const asset = await loadDocAssetForFile(event, getRouterParam(event, "assetId"));

  const url = await createDocAssetDownloadUrl(asset.s3Key, {
    fileName: asset.fileName,
    contentType: asset.mimeType,
    download: getQuery(event).download === "1",
  });
  setResponseHeader(event, "Cache-Control", "private, no-store");
  return sendRedirect(event, url, 302);
});
