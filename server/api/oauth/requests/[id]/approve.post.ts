import { defineEventHandler, createError, getRouterParam } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { getCurrentMember } from "~/server/utils/team-access";
import {
  consumePendingRequest,
  issueAuthorizationCode,
} from "~/server/utils/mcp-oauth/store";
import { getMcpOAuthIssuer } from "~/server/utils/mcp-oauth/config";
import { buildClientRedirectUrl } from "~/server/utils/mcp-oauth/consent";

/**
 * Approves a pending MCP authorization request.
 *
 * Only the signed-in user can approve, and the issued authorization code is
 * bound to their user id — the OAuth client never touches another identity.
 * Requires active workspace membership: valid sessions without a member row
 * cannot delegate MCP access.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const requestId = getRouterParam(event, "id");

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing authorization request id.",
    });
  }

  const member = await getCurrentMember(event).catch(() => null);
  if (!member) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You are not a member of this workspace.",
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

  const code = await issueAuthorizationCode({
    clientId: pending.clientId,
    userId: user.id,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    scope: pending.scope,
  });

  return {
    redirect_url: buildClientRedirectUrl(pending.redirectUri, {
      code,
      iss: getMcpOAuthIssuer(),
      ...(pending.state ? { state: pending.state } : {}),
    }),
  };
});
