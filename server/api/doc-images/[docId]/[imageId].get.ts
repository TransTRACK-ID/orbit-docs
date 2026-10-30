import { createError, defineEventHandler, getRouterParam, sendRedirect, setResponseHeader } from "h3";
import { loadDocForImage } from "~/server/lib/doc-assets";
import { buildDocImageKey, createDocImageDownloadUrl, isValidUuid } from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  const doc = await loadDocForImage(event, getRouterParam(event, "docId"));
  const imageId = getRouterParam(event, "imageId");
  if (!imageId || !isValidUuid(imageId)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Image not found" });
  }

  const url = await createDocImageDownloadUrl(buildDocImageKey(doc.id, imageId));
  // Shorter than the presigned URL lifetime so a cached redirect never points at an expired link.
  setResponseHeader(event, "Cache-Control", "private, max-age=300");
  return sendRedirect(event, url, 302);
});
