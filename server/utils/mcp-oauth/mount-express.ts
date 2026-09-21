import express, { type Request, type Response } from "express";
import {
  getAuthorizationEndpoint,
  getMcpOAuthIssuer,
  getMcpResourceUrl,
  getRegistrationEndpoint,
  getTokenEndpoint,
  isMcpOAuthEnabled,
} from "./config";
import { createAuthorizationCode, consumeAuthorizationCode } from "./codes";
import { verifyPkceS256 } from "./pkce";
import { issueMcpAccessToken, refreshMcpAccessToken } from "./tokens";
import {
  isRedirectUriAllowed,
  registerClient,
  validateClientCredentials,
} from "./clients";
import { renderConsentPage } from "./consent";

function oauthError(res: Response, status: number, error: string, description?: string): void {
  res.status(status).json({
    error,
    error_description: description,
  });
}

function parseClientCredentials(req: Request): {
  clientId?: string;
  clientSecret?: string;
} {
  const authHeader = req.headers.authorization;
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

  const body = req.body as Record<string, unknown>;
  return {
    clientId: typeof body.client_id === "string" ? body.client_id : undefined,
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : undefined,
  };
}

function buildRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function handleAuthorize(req: Request, res: Response): Promise<void> {
  const clientId = typeof req.query.client_id === "string" ? req.query.client_id : undefined;
  const redirectUri =
    typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : undefined;
  const responseType =
    typeof req.query.response_type === "string" ? req.query.response_type : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const scope = typeof req.query.scope === "string" ? req.query.scope : "mcp:read";
  const codeChallenge =
    typeof req.query.code_challenge === "string" ? req.query.code_challenge : undefined;
  const codeChallengeMethod =
    typeof req.query.code_challenge_method === "string"
      ? req.query.code_challenge_method
      : undefined;
  const approved = req.query.approved === "1";

  if (!clientId || !redirectUri || responseType !== "code") {
    oauthError(
      res,
      400,
      "invalid_request",
      "client_id, redirect_uri, and response_type=code are required.",
    );
    return;
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    oauthError(
      res,
      400,
      "invalid_request",
      "PKCE with code_challenge_method=S256 is required.",
    );
    return;
  }

  if (!(await isRedirectUriAllowed(clientId, redirectUri))) {
    oauthError(res, 400, "invalid_request", "redirect_uri is not allowed.");
    return;
  }

  if (!approved) {
    res
      .status(200)
      .type("html")
      .send(
        renderConsentPage({
          clientId,
          scope,
          state,
          redirectUri,
          codeChallenge,
          codeChallengeMethod,
          responseType,
        }),
      );
    return;
  }

  const code = createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    scope,
  });

  res.redirect(
    buildRedirectUrl(redirectUri, {
      code,
      ...(state ? { state } : {}),
    }),
  );
}

async function handleToken(req: Request, res: Response): Promise<void> {
  const grantType = typeof req.body?.grant_type === "string" ? req.body.grant_type : undefined;

  if (grantType === "refresh_token") {
    const refreshToken =
      typeof req.body?.refresh_token === "string" ? req.body.refresh_token : undefined;
    if (!refreshToken) {
      oauthError(res, 400, "invalid_request", "refresh_token is required.");
      return;
    }
    const result = refreshMcpAccessToken(refreshToken);
    if (!result) {
      oauthError(res, 400, "invalid_grant", "Refresh token is invalid or expired.");
      return;
    }
    res.json({
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: result.expiresIn,
      scope: "mcp:read",
      resource: getMcpResourceUrl(),
      refresh_token: result.refreshToken,
    });
    return;
  }

  if (grantType !== "authorization_code") {
    oauthError(res, 400, "unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
    return;
  }

  const code = typeof req.body?.code === "string" ? req.body.code : undefined;
  const redirectUri =
    typeof req.body?.redirect_uri === "string" ? req.body.redirect_uri : undefined;
  const codeVerifier =
    typeof req.body?.code_verifier === "string" ? req.body.code_verifier : undefined;
  const { clientId, clientSecret } = parseClientCredentials(req);
  const bodyClientId =
    typeof req.body?.client_id === "string" ? req.body.client_id : clientId;

  if (!code || !redirectUri || !bodyClientId) {
    oauthError(res, 400, "invalid_request", "code, redirect_uri, and client_id are required.");
    return;
  }

  if (!validateClientCredentials(bodyClientId, clientSecret)) {
    oauthError(res, 401, "invalid_client", "Client authentication failed.");
    return;
  }

  const record = consumeAuthorizationCode(code);
  if (!record) {
    oauthError(res, 400, "invalid_grant", "Authorization code is invalid or expired.");
    return;
  }

  if (record.clientId !== bodyClientId || record.redirectUri !== redirectUri) {
    oauthError(res, 400, "invalid_grant", "Authorization code does not match the client.");
    return;
  }

  if (!verifyPkceS256(codeVerifier, record.codeChallenge)) {
    oauthError(res, 400, "invalid_grant", "PKCE verification failed.");
    return;
  }

  const { accessToken, expiresIn, refreshToken } = issueMcpAccessToken(bodyClientId, record.scope);
  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: record.scope,
    resource: getMcpResourceUrl(),
    refresh_token: refreshToken,
  });
}

function handleAuthorizationServerMetadata(_req: Request, res: Response): void {
  const issuer = getMcpOAuthIssuer();
  res.json({
    issuer,
    authorization_endpoint: getAuthorizationEndpoint(),
    token_endpoint: getTokenEndpoint(),
    registration_endpoint: getRegistrationEndpoint(),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    scopes_supported: ["mcp:read"],
    client_id_metadata_document_supported: true,
  });
}

/**
 * RFC 7591 dynamic client registration — lets MCP clients self-register
 * instead of requiring pre-shared credentials.
 */
function handleRegister(req: Request, res: Response): void {
  const body = req.body as Record<string, unknown> | undefined;
  const redirectUris =
    body && Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string")
      : [];

  const result = registerClient({
    redirectUris,
    clientName: typeof body?.client_name === "string" ? body.client_name : undefined,
    tokenEndpointAuthMethod:
      typeof body?.token_endpoint_auth_method === "string"
        ? body.token_endpoint_auth_method
        : undefined,
  });

  if ("error" in result) {
    oauthError(res, 400, "invalid_client_metadata", result.error);
    return;
  }

  res.status(201).json({
    client_id: result.clientId,
    ...(result.clientSecret ? { client_secret: result.clientSecret } : {}),
    client_name: result.clientName,
    redirect_uris: result.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: result.tokenEndpointAuthMethod,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
  });
}

function handleProtectedResourceMetadata(_req: Request, res: Response): void {
  res.json({
    resource: getMcpResourceUrl(),
    authorization_servers: [getMcpOAuthIssuer()],
    scopes_supported: ["mcp:read"],
    bearer_methods_supported: ["header"],
  });
}

/**
 * Mount MCP OAuth 2.0 + PKCE routes onto an Express app.
 * No-ops when OAuth is not enabled (client id/secret unset).
 */
export function mountMcpOAuth(app: express.Application): void {
  if (!isMcpOAuthEnabled()) {
    return;
  }

  app.get("/.well-known/oauth-authorization-server", handleAuthorizationServerMetadata);
  app.get("/.well-known/oauth-protected-resource", handleProtectedResourceMetadata);
  // RFC 9728: resource at /mcp requires metadata at this path for MCP clients like Gemini.
  app.get("/.well-known/oauth-protected-resource/mcp", handleProtectedResourceMetadata);
  app.get("/oauth/authorize", (req, res) => {
    void handleAuthorize(req, res);
  });
  app.post("/oauth/register", express.json(), handleRegister);
  app.post(
    "/oauth/token",
    express.urlencoded({ extended: false }),
    (req, res) => {
      void handleToken(req, res);
    },
  );

  console.log(
    `MCP OAuth enabled (issuer: ${getMcpOAuthIssuer()}, authorize: /oauth/authorize, token: /oauth/token, register: /oauth/register)`,
  );
}
