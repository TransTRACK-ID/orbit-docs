import { defineEventHandler, readBody, getHeader, createError } from "h3";
import {
  getMcpResourceUrl,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";
import {
  cleanupExpiredGrants,
  consumeAuthorizationCode,
  issueRefreshToken,
  rotateRefreshToken,
} from "~/server/utils/mcp-oauth/store";
import { verifyPkceS256 } from "~/server/utils/mcp-oauth/pkce";
import { issueMcpAccessToken } from "~/server/utils/mcp-oauth/tokens";
import { validateClientCredentialsAsync } from "~/server/utils/mcp-oauth/clients";

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
  const resource = typeof body.resource === "string" ? body.resource : undefined;

  if (resource && resource !== getMcpResourceUrl()) {
    throw oauthError(400, "invalid_target", "resource does not match this MCP server.");
  }

  if (grantType === "refresh_token") {
    const refreshToken =
      typeof body.refresh_token === "string" ? body.refresh_token : undefined;
    const clientId =
      typeof body.client_id === "string" ? body.client_id : undefined;
    if (!refreshToken || !clientId) {
      throw oauthError(400, "invalid_request", "refresh_token and client_id are required.");
    }
    const result = await rotateRefreshToken(refreshToken);
    if (result.status === "invalid" || result.status === "replay") {
      throw oauthError(400, "invalid_grant", "Refresh token is invalid, expired, or already used.");
    }
    if (result.record.clientId !== clientId) {
      throw oauthError(400, "invalid_grant", "Refresh token was issued to another client.");
    }
    const { accessToken, expiresIn } = issueMcpAccessToken({
      userId: result.record.userId,
      clientId: result.record.clientId,
      scope: result.record.scope,
    });
    void cleanupExpiredGrants();
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: result.record.scope,
      resource: getMcpResourceUrl(),
      refresh_token: result.token,
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

  if (!(await validateClientCredentialsAsync(bodyClientId, clientSecret))) {
    throw oauthError(401, "invalid_client", "Client authentication failed.");
  }

  const record = await consumeAuthorizationCode(code);
  if (!record) {
    throw oauthError(400, "invalid_grant", "Authorization code is invalid, expired, or already used.");
  }

  if (record.clientId !== bodyClientId || record.redirectUri !== redirectUri) {
    throw oauthError(400, "invalid_grant", "Authorization code does not match the client.");
  }

  if (!verifyPkceS256(codeVerifier, record.codeChallenge)) {
    throw oauthError(400, "invalid_grant", "PKCE verification failed.");
  }

  const { accessToken, expiresIn } = issueMcpAccessToken({
    userId: record.userId,
    clientId: record.clientId,
    scope: record.scope,
  });
  const { token: refreshToken } = await issueRefreshToken({
    userId: record.userId,
    clientId: record.clientId,
    scope: record.scope,
  });
  void cleanupExpiredGrants();
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: record.scope,
    resource: getMcpResourceUrl(),
    refresh_token: refreshToken,
  };
});
