import type { H3Event } from "h3";
import { getQuery, readBody, setResponseStatus, sendRedirect } from "h3";
import {
  getAuthorizationEndpoint,
  getMcpOAuthClientId,
  getTokenEndpoint,
  isMcpOAuthEnabled,
  resolveMcpOAuthContext,
} from "~/server/utils/mcp-oauth/config";
import { createAuthorizationCode, consumeAuthorizationCode } from "~/server/utils/mcp-oauth/codes";
import { verifyPkceS256 } from "~/server/utils/mcp-oauth/pkce";
import { issueMcpAccessToken } from "~/server/utils/mcp-oauth/tokens";
import {
  isRedirectUriAllowed,
  validateStaticClientCredentials,
} from "~/server/utils/mcp-oauth/clients";

function oauthError(event: H3Event, status: number, error: string, description?: string) {
  setResponseStatus(event, status);
  return {
    error,
    error_description: description,
  };
}

function buildRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function renderConsentPage(input: {
  clientId: string;
  scope: string;
  state?: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  responseType: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scope,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    response_type: input.responseType,
    approved: "1",
  });

  if (input.state) {
    params.set("state", input.state);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize MCP Access</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1419; color: #e7ecf3; margin: 0; min-height: 100vh; display: grid; place-items: center; }
    .card { width: min(480px, 92vw); background: #171d25; border: 1px solid #2a3441; border-radius: 16px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 1.35rem; }
    p { margin: 0 0 16px; color: #a8b3c2; line-height: 1.5; }
    .scope { background: #10161d; border-radius: 10px; padding: 12px 14px; margin-bottom: 20px; font-family: ui-monospace, monospace; font-size: .9rem; }
    .actions { display: flex; gap: 12px; }
    button, a.button { flex: 1; text-align: center; border-radius: 10px; padding: 12px 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; }
    .approve { background: #3b82f6; color: white; }
    .deny { background: transparent; color: #c6d0dc; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Allow Orbit Docs MCP access?</h1>
    <p>An application is requesting read-only access to your Orbit Docs MCP server.</p>
    <div class="scope">scope: ${input.scope || "mcp:read"}</div>
    <div class="actions">
      <a class="button deny" href="${buildRedirectUrl(input.redirectUri, {
        error: "access_denied",
        error_description: "User denied the authorization request",
        ...(input.state ? { state: input.state } : {}),
      })}">Deny</a>
      <form method="GET" action="/oauth/authorize" style="flex:1;display:flex;">
        ${Array.from(params.entries())
          .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
          .join("")}
        <button class="approve" type="submit" style="width:100%;">Allow</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

export function getAuthorizationServerMetadata(event: H3Event) {
  const { issuer } = resolveMcpOAuthContext(event);
  return {
    issuer,
    authorization_endpoint: getAuthorizationEndpoint(event),
    token_endpoint: getTokenEndpoint(event),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    scopes_supported: ["mcp:read"],
    client_id_metadata_document_supported: true,
  };
}

export function getProtectedResourceMetadata(event: H3Event) {
  const { issuer, resource } = resolveMcpOAuthContext(event);
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: ["mcp:read"],
    bearer_methods_supported: ["header"],
  };
}

export async function handleOAuthAuthorize(event: H3Event) {
  if (!isMcpOAuthEnabled()) {
    return oauthError(event, 503, "server_error", "MCP OAuth is not configured on this server.");
  }

  const query = getQuery(event);
  const clientId = typeof query.client_id === "string" ? query.client_id : undefined;
  const redirectUri = typeof query.redirect_uri === "string" ? query.redirect_uri : undefined;
  const responseType = typeof query.response_type === "string" ? query.response_type : undefined;
  const state = typeof query.state === "string" ? query.state : undefined;
  const scope = typeof query.scope === "string" ? query.scope : "mcp:read";
  const codeChallenge = typeof query.code_challenge === "string" ? query.code_challenge : undefined;
  const codeChallengeMethod =
    typeof query.code_challenge_method === "string" ? query.code_challenge_method : undefined;
  const approved = query.approved === "1";

  if (!clientId || !redirectUri || responseType !== "code") {
    return oauthError(
      event,
      400,
      "invalid_request",
      "client_id, redirect_uri, and response_type=code are required.",
    );
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return oauthError(
      event,
      400,
      "invalid_request",
      "PKCE with code_challenge_method=S256 is required.",
    );
  }

  if (!(await isRedirectUriAllowed(clientId, redirectUri))) {
    return oauthError(event, 400, "invalid_request", "redirect_uri is not allowed.");
  }

  if (!approved) {
    setHeader(event, "Content-Type", "text/html; charset=utf-8");
    return renderConsentPage({
      clientId,
      scope,
      state,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      responseType,
    });
  }

  const code = createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    scope,
  });

  return sendRedirect(
    event,
    buildRedirectUrl(redirectUri, {
      code,
      ...(state ? { state } : {}),
    }),
  );
}

function parseClientCredentials(event: H3Event, body: Record<string, unknown>) {
  const authHeader = getHeader(event, "authorization");
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

export async function handleOAuthToken(event: H3Event) {
  if (!isMcpOAuthEnabled()) {
    return oauthError(event, 503, "server_error", "MCP OAuth is not configured on this server.");
  }

  const rawBody = await readBody(event);
  const body =
    typeof rawBody === "string"
      ? Object.fromEntries(new URLSearchParams(rawBody))
      : ((rawBody || {}) as Record<string, unknown>);

  const grantType = typeof body.grant_type === "string" ? body.grant_type : undefined;
  if (grantType !== "authorization_code") {
    return oauthError(event, 400, "unsupported_grant_type", "Only authorization_code is supported.");
  }

  const code = typeof body.code === "string" ? body.code : undefined;
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : undefined;
  const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier : undefined;
  const { clientId, clientSecret } = parseClientCredentials(event, body);
  const bodyClientId = typeof body.client_id === "string" ? body.client_id : clientId;

  if (!code || !redirectUri || !bodyClientId) {
    return oauthError(event, 400, "invalid_request", "code, redirect_uri, and client_id are required.");
  }

  const expectedClientId = getMcpOAuthClientId();
  if (bodyClientId === expectedClientId) {
    if (!validateStaticClientCredentials(bodyClientId, clientSecret)) {
      return oauthError(event, 401, "invalid_client", "Client authentication failed.");
    }
  } else if (!/^https?:\/\//i.test(bodyClientId)) {
    return oauthError(event, 401, "invalid_client", "Unknown client_id.");
  }

  const record = consumeAuthorizationCode(code);
  if (!record) {
    return oauthError(event, 400, "invalid_grant", "Authorization code is invalid or expired.");
  }

  if (record.clientId !== bodyClientId || record.redirectUri !== redirectUri) {
    return oauthError(event, 400, "invalid_grant", "Authorization code does not match the client.");
  }

  if (!verifyPkceS256(codeVerifier, record.codeChallenge)) {
    return oauthError(event, 400, "invalid_grant", "PKCE verification failed.");
  }

  const { accessToken, expiresIn } = issueMcpAccessToken(bodyClientId, record.scope, event);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: record.scope,
  };
}
