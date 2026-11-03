import { defineEventHandler, createError, getRouterParam } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { consumePendingRequest } from "~/server/utils/mcp-oauth/store";
import { buildClientRedirectUrl } from "~/server/utils/mcp-oauth/consent";

/** Denies a pending MCP authorization request (requires sign-in). */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const requestId = getRouterParam(event, "id");

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing authorization request id.",
    });
  }

  const pending = await consumePendingRequest(requestId);
  if (!pending) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "This authorization request is invalid or has expired. Start the connection again from your AI app.",
    });
  }

  return {
    redirect_url: buildClientRedirectUrl(pending.redirectUri, {
      error: "access_denied",
      error_description: "The user denied the authorization request.",
      ...(pending.state ? { state: pending.state } : {}),
    }),
  };
});
