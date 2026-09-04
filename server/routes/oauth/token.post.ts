import { defineEventHandler, readBody, getHeader, createError } from "h3";
import {
  getMcpOAuthClientId,
  getMcpResourceUrl,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";
import { consumeAuthorizationCode } from "~/server/utils/mcp-oauth/codes";
import { verifyPkceS256 } from "~/server/utils/mcp-oauth/pkce";
import { issueMcpAccessToken, refreshMcpAccessToken } from "~/server/utils/mcp-oauth/tokens";
import {
  isRedirectUriAllowed,
  validateStaticClientCredentials,
} from "~/server/utils/mcp-oauth/clients";

function parseClientCredentials(
  authHeader: string | undefined,
  body: Record<string, unknown>,
): { clientId?: string; clientSecret?: string } {
  if (authHeader?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const separatorIndex = decoded.indexOf(":");
      if (separatorIndex >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separatorIndex)),
          clientSecret: decodeURIComponent(decoded.slice(separatorIndex + 1)),
        };
      }
    } catch {
      return {};
    }
  }

  return {
    clientId: typeof body.client_id === "string" ? body.client_id : undefined,
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : undefined,
  };
}

function oauthError(status: number, error: string, description?: string) {
  return createError({
    statusCode: status,
    statusMessage: error,
    message: description || error,
    data: { error, error_description: description },
  });
}

export default defineEventHandler(async (event) => {
  if (!isMcpOAuthEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "MCP OAuth is not configured on the server.",
    });
  }

  const body = (await readBody(event)) as Record<string, unknown>;
  const grantType = typeof body.grant_type === "string" ? body.grant_type : undefined;

  if (grantType === "refresh_token") {
    const refreshToken =
      typeof body.refresh_token === "string" ? body.refresh_token : undefined;
    if (!refreshToken) {
      throw oauthError(400, "invalid_request", "refresh_token is required.");
    }
    const result = refreshMcpAccessToken(refreshToken);
    if (!result) {
      throw oauthError(400, "invalid_grant", "Refresh token is invalid or expired.");
    }
    return {
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: result.expiresIn,
      scope: "mcp:read",
      resource: getMcpResourceUrl(),
      refresh_token: result.refreshToken,
    };
  }

  if (grantType !== "authorization_code") {
    throw oauthError(400, "unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
  }

  const code = typeof body.code === "string" ? body.code : undefined;
  const redirectUri =
    typeof body.redirect_uri === "string" ? body.redirect_uri : undefined;
  const codeVerifier =
    typeof body.code_verifier === "string" ? body.code_verifier : undefined;
  const { clientId, clientSecret } = parseClientCredentials(
    getHeader(event, "authorization"),
    body,
  );
  const bodyClientId =
    typeof body.client_id === "string" ? body.client_id : clientId;

  if (!code || !redirectUri || !bodyClientId) {
    throw oauthError(400, "invalid_request", "code, redirect_uri, and client_id are required.");
  }

  const staticClientConfigured = validateStaticClientCredentials(bodyClientId, clientSecret);
  const expectedClientId = getMcpOAuthClientId();

  if (bodyClientId === expectedClientId) {
    if (!staticClientConfigured) {
      throw oauthError(401, "invalid_client", "Client authentication failed.");
    }
  } else if (!/^https?:\/\//i.test(bodyClientId)) {
    throw oauthError(401, "invalid_client", "Unknown client_id.");
  }

  const record = consumeAuthorizationCode(code);
  if (!record) {
    throw oauthError(400, "invalid_grant", "Authorization code is invalid or expired.");
  }

  if (record.clientId !== bodyClientId || record.redirectUri !== redirectUri) {
    throw oauthError(400, "invalid_grant", "Authorization code does not match the client.");
  }

  if (!verifyPkceS256(codeVerifier, record.codeChallenge)) {
    throw oauthError(400, "invalid_grant", "PKCE verification failed.");
  }

  const { accessToken, expiresIn, refreshToken } = issueMcpAccessToken(bodyClientId, record.scope);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: record.scope,
    resource: getMcpResourceUrl(),
    refresh_token: refreshToken,
  };
});
