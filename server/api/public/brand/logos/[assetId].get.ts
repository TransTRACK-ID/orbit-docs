import { defineEventHandler, getRouterParam, createError } from "h3";
import { streamLogoMedia } from "~/server/lib/logo-media-stream";

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, "assetId");

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Asset ID is required",
    });
  }

  return streamLogoMedia(event, assetId);
});
