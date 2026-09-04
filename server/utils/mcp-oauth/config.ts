/**
 * MCP OAuth 2.0 configuration — reads all settings from process.env.
 *
 * Shared by the Nitro-hosted MCP endpoints (/api/mcp/*) and the standalone
 * Express MCP server (mcp-server.ts).  No Nuxt-specific imports so it works
 * in both contexts.
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getMcpOAuthIssuer(): string {
  const fromEnv =
    process.env.MCP_OAUTH_ISSUER?.trim() ||
    process.env.NUXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return trimTrailingSlash(fromEnv);
  }
  return "http://localhost:3000";
}

/**
 * The protected resource URL — the MCP endpoint clients connect to.
 * Defaults to the Nitro-hosted path (/api/mcp/connect).  Set
 * MCP_OAUTH_RESOURCE_PATH=/mcp for the standalone server.
 */
export function getMcpResourceUrl(): string {
  const path = process.env.MCP_OAUTH_RESOURCE_PATH?.trim() || "/api/mcp/connect";
  return `${getMcpOAuthIssuer()}${path}`;
}

export function getMcpOAuthClientId(): string | undefined {
  return process.env.MCP_OAUTH_CLIENT_ID?.trim() || undefined;
}

export function getMcpOAuthClientSecret(): string | undefined {
  return process.env.MCP_OAUTH_CLIENT_SECRET?.trim() || undefined;
}

export function isMcpOAuthEnabled(): boolean {
  return Boolean(getMcpOAuthClientId() && getMcpOAuthClientSecret());
}

export function getMcpOAuthSigningSecret(): string {
  return (
    process.env.MCP_OAUTH_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "mcp-oauth-signing-secret-change-in-production"
  );
}

export function getMcpOAuthTokenExpirySeconds(): number {
  const parsed = Number.parseInt(process.env.MCP_OAUTH_TOKEN_EXPIRY || "3600", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

export function getConfiguredRedirectUris(): string[] {
  const raw = process.env.MCP_OAUTH_REDIRECT_URIS?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

export function getAuthorizationEndpoint(): string {
  return `${getMcpOAuthIssuer()}/oauth/authorize`;
}

export function getTokenEndpoint(): string {
  return `${getMcpOAuthIssuer()}/oauth/token`;
}

export function getProtectedResourceMetadataUrl(): string {
  return `${getMcpOAuthIssuer()}/.well-known/oauth-protected-resource/mcp`;
}
