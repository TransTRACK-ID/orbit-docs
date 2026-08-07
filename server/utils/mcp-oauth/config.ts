import type { H3Event } from "h3";
import { getPublicAppUrl } from "~/server/utils/runtime-env";

const MCP_RESOURCE_SUFFIX = "/api/mcp/connect";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveMcpOAuthContext(event?: H3Event) {
  if (event) {
    const protocol = getRequestProtocol(event);
    const host = getRequestHost(event);
    const issuer = trimTrailingSlash(
      process.env.MCP_OAUTH_ISSUER?.trim() || `${protocol}://${host}`,
    );
    const resource = `${protocol}://${host}${withBaseURL(MCP_RESOURCE_SUFFIX)}`;
    return { issuer, resource };
  }

  const publicAppUrl = trimTrailingSlash(getPublicAppUrl() || "http://localhost:3000");
  const basePath = (process.env.NUXT_APP_BASE_URL || "/").replace(/\/$/, "");
  const issuer = trimTrailingSlash(process.env.MCP_OAUTH_ISSUER?.trim() || publicAppUrl);
  const resource = `${publicAppUrl}${basePath}${MCP_RESOURCE_SUFFIX}`;

  return { issuer, resource };
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
    process.env.NUXT_JWT_SECRET?.trim() ||
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

export function getAuthorizationEndpoint(event?: H3Event): string {
  const { issuer } = resolveMcpOAuthContext(event);
  return `${issuer}/oauth/authorize`;
}

export function getTokenEndpoint(event?: H3Event): string {
  const { issuer } = resolveMcpOAuthContext(event);
  return `${issuer}/oauth/token`;
}

export function getProtectedResourceMetadataUrl(event?: H3Event): string {
  const { issuer, resource } = resolveMcpOAuthContext(event);
  const resourcePath = new URL(resource).pathname.replace(/^\/+/, "");
  return `${issuer}/.well-known/oauth-protected-resource/${resourcePath}`;
}
