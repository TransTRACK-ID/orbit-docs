import { defineEventHandler, getRouterParam, createError } from "h3";
import { streamReleaseMedia } from "~/server/lib/release-media-stream";

export default defineEventHandler(async (event) => {
  const releaseId = getRouterParam(event, "id");
  const assetId = getRouterParam(event, "assetId");

  if (!releaseId || !assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Release ID and asset ID are required",
    });
  }

  return streamReleaseMedia(event, releaseId, assetId);
});
