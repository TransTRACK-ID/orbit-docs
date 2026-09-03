import { defineEventHandler, readBody, createError } from "h3";
import { requireSuperAdmin } from "~/server/utils/rbac";
import { saveCursorApiKey } from "~/server/utils/cursor-api-key";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  const body = await readBody(event);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey : undefined;

  if (apiKey === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "apiKey is required",
    });
  }

  // Reject the mask placeholder — user must type a real key or empty to clear.
  if (apiKey.trim() === "••••••••") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Please enter a new API key to update.",
    });
  }

  await saveCursorApiKey(apiKey);

  return { data: { saved: true } };
});
