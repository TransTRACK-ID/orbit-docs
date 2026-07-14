import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { requireApiKey } from "~/server/utils/api-key-auth";
import { syncFeaturesToOrbit } from "~/server/lib/feature-sync";

export default defineEventHandler(async (event) => {
  await requireApiKey(event);

  const appId = getRouterParam(event, "id");
  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const body = await readBody(event);
  const features = body?.features;
  const options = body?.options || {};

  if (!Array.isArray(features)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "features must be an array",
    });
  }

  try {
    const data = await syncFeaturesToOrbit(appId, features, {
      archiveMissing: options.archiveMissing === true,
      maxBatchSize:
        typeof options.maxBatchSize === "number" ? options.maxBatchSize : undefined,
    });

    return { data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    if (message === "App not found") {
      throw createError({ statusCode: 404, statusMessage: "Not Found", message });
    }
    if (message.includes("exceeds limit")) {
      throw createError({ statusCode: 400, statusMessage: "Bad Request", message });
    }
    throw createError({ statusCode: 500, statusMessage: "Internal Server Error", message });
  }
});
