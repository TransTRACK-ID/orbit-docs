import { defineEventHandler, readBody, createError, setResponseStatus } from "h3";
import { isMcpOAuthEnabled } from "~/server/utils/mcp-oauth/config";
import { registerClient } from "~/server/utils/mcp-oauth/clients";

/**
 * RFC 7591 dynamic client registration — lets MCP clients (Claude, Cursor,
 * Inspector, …) self-register instead of requiring pre-shared credentials.
 * The user consent step is the real security boundary, so clients may
 * register as public (token_endpoint_auth_method "none", PKCE only).
 */
export default defineEventHandler(async (event) => {
  if (!isMcpOAuthEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "MCP OAuth is not configured on the server.",
    });
  }

  const body = (await readBody(event)) as Record<string, unknown> | null;
  const redirectUris =
    body && Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string")
      : [];

  const result = registerClient({
    redirectUris,
    clientName:
      typeof body?.client_name === "string" ? body.client_name : undefined,
    tokenEndpointAuthMethod:
      typeof body?.token_endpoint_auth_method === "string"
        ? body.token_endpoint_auth_method
        : undefined,
  });

  if ("error" in result) {
    throw createError({
      statusCode: 400,
      statusMessage: "invalid_client_metadata",
      message: result.error,
      data: { error: "invalid_client_metadata", error_description: result.error },
    });
  }

  setResponseStatus(event, 201);
  return {
    client_id: result.clientId,
    ...(result.clientSecret ? { client_secret: result.clientSecret } : {}),
    client_name: result.clientName,
    redirect_uris: result.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: result.tokenEndpointAuthMethod,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
  };
});
