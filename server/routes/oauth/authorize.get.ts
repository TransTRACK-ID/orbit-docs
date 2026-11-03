import { defineEventHandler, getQuery, createError, sendRedirect } from "h3";
import {
  getMcpResourceUrl,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";
import { createPendingRequest, cleanupExpiredGrants } from "~/server/utils/mcp-oauth/store";
import { isRedirectUriAllowedAsync, resolveClientAsync } from "~/server/utils/mcp-oauth/clients";
import { withBaseURL } from "~/server/utils/base-url";

/**
 * OAuth authorization endpoint.
 *
 * Validates the client, redirect URI, and PKCE parameters, then stores a
 * short-lived pending authorization request and redirects the user's browser
 * to the consent page. The consent page requires a signed-in orbit-docs
 * session — anonymous `?approved=1` self-approval is not possible.
 */
export default defineEventHandler(async (event) => {
  if (!isMcpOAuthEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "MCP OAuth is not configured on the server.",
    });
  }

  const query = getQuery(event);
  const clientId = typeof query.client_id === "string" ? query.client_id : undefined;
  const redirectUri =
    typeof query.redirect_uri === "string" ? query.redirect_uri : undefined;
  const responseType =
    typeof query.response_type === "string" ? query.response_type : undefined;
  const state = typeof query.state === "string" ? query.state : undefined;
  const scope = typeof query.scope === "string" ? query.scope : "mcp:read";
  const resource = typeof query.resource === "string" ? query.resource : undefined;
  const codeChallenge =
    typeof query.code_challenge === "string" ? query.code_challenge : undefined;
  const codeChallengeMethod =
    typeof query.code_challenge_method === "string"
      ? query.code_challenge_method
      : undefined;

  if (!clientId || !redirectUri || responseType !== "code") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "client_id, redirect_uri, and response_type=code are required.",
    });
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "PKCE with code_challenge_method=S256 is required.",
    });
  }

  if (resource && resource !== getMcpResourceUrl()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "resource does not match this MCP server.",
    });
  }

  const client = await resolveClientAsync(clientId);
  if (!client) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Unknown client_id. Register via POST /oauth/register first.",
    });
  }

  if (!(await isRedirectUriAllowedAsync(clientId, redirectUri))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "redirect_uri is not allowed.",
    });
  }

  let requestId: string;
  try {
    requestId = await createPendingRequest({
      clientId,
      clientName: client.clientName,
      redirectUri,
      state,
      scope,
      codeChallenge,
    });
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "Authorization store is unavailable.",
    });
  }
  void cleanupExpiredGrants();

  return sendRedirect(
    event,
    withBaseURL(`/oauth/consent?request_id=${encodeURIComponent(requestId)}`),
  );
});
