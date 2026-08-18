import {
  defineEventHandler,
  createError,
  readMultipartFormData,
} from "h3";
import { getAuthContext } from "~/server/utils/rbac";
import { roleHasPermission } from "~/server/lib/permissions";
import { withBaseURL } from "~/server/utils/base-url";
import {
  buildLogoProxyPath,
  uploadLogoAsset,
} from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  const context = await getAuthContext(event);

  if (!context.isSuperAdmin) {
    if (!context.role) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "You are not a member of this workspace.",
      });
    }

    const canUpload =
      roleHasPermission(context.role, "settings:write", context.matrix) ||
      roleHasPermission(context.role, "apps:write", context.matrix);

    if (!canUpload) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "Missing permission to upload logos",
      });
    }
  }

  const form = await readMultipartFormData(event);
  const filePart = form?.find((part) => part.name === "file" && part.data);

  if (!filePart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing file field in multipart upload",
    });
  }

  const buffer = Buffer.from(filePart.data);
  const contentType = filePart.type || "application/octet-stream";

  const { assetId } = await uploadLogoAsset(buffer, contentType);
  const proxyPath = buildLogoProxyPath(assetId);

  return {
    data: {
      assetId,
      url: withBaseURL(proxyPath),
      path: proxyPath,
    },
  };
});
