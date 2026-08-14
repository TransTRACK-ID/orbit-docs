import {
  defineEventHandler,
  createError,
  getRouterParam,
  readMultipartFormData,
  sendStream,
  setResponseHeader,
} from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { releases } from "~/server/database/schema";
import { requirePermission } from "~/server/utils/rbac";
import { withBaseURL } from "~/server/utils/base-url";
import {
  buildReleaseMediaProxyPath,
  uploadReleaseAsset,
} from "~/server/lib/s3-storage";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "releases:write");

  const releaseId = getRouterParam(event, "id");
  if (!releaseId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Release ID is required",
    });
  }

  const db = getDb();
  const release = await db
    .select({ id: releases.id })
    .from(releases)
    .where(eq(releases.id, releaseId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!release) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Release not found",
    });
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

  const { assetId } = await uploadReleaseAsset(releaseId, buffer, contentType);
  const proxyPath = buildReleaseMediaProxyPath(releaseId, assetId);

  return {
    data: {
      assetId,
      url: withBaseURL(proxyPath),
      path: proxyPath,
    },
  };
});
