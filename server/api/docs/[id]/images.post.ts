import { createError, defineEventHandler, readMultipartFormData } from "h3";
import { docImagePath, requireDocAssetAccess } from "~/server/lib/doc-assets";
import { uploadDocImage } from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");

  const form = await readMultipartFormData(event);
  const filePart = form?.find((part) => part.name === "file" && part.data);
  if (!filePart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing file field in multipart upload",
    });
  }

  const imageId = await uploadDocImage(
    doc.id,
    Buffer.from(filePart.data),
    filePart.type || "application/octet-stream",
  );

  return { data: { path: docImagePath(doc.id, imageId) } };
});
