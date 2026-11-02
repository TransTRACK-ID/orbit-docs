import { defineEventHandler, getRouterParam } from "h3";
import { loadSharedDocAsset } from "~/server/lib/doc-assets";
import { withBaseURL } from "~/server/utils/base-url";

export default defineEventHandler(async (event) => {
  const asset = await loadSharedDocAsset(event, getRouterParam(event, "token"));

  return {
    data: {
      title: asset.title,
      fileName: asset.fileName,
      sizeBytes: asset.sizeBytes,
      sharedAt: asset.sharedAt,
      fileUrl: withBaseURL(`/api/public/doc-assets/${asset.shareToken}/file`),
    },
  };
});
