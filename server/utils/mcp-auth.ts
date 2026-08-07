import type { H3Event } from "h3";
import { createError, getHeader, setResponseHeader } from "h3";
import { checkMcpApiKey } from "~/server/utils/mcp-server";
import {
  getProtectedResourceMetadataUrl,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";
import { verifyMcpAccessToken } from "~/server/utils/mcp-oauth/tokens";

export function isMcpRemoteAuthConfigured(): boolean {
  return Boolean(process.env.MCP_API_KEY) || isMcpOAuthEnabled();
}

export function isMcpAuthSatisfied(event: H3Event): boolean {
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");

  if (checkMcpApiKey(authHeader, apiKeyHeader)) {
    return true;
  }

  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (isMcpOAuthEnabled() && bearerToken && verifyMcpAccessToken(bearerToken, event)) {
    return true;
  }

  return false;
}

export function assertMcpAuth(event: H3Event): void {
  if (isMcpAuthSatisfied(event)) {
    return;
  }

  if (isMcpOAuthEnabled()) {
    setResponseHeader(
      event,
      "WWW-Authenticate",
      `Bearer realm="mcp", resource_metadata="${getProtectedResourceMetadataUrl(event)}", scope="mcp:read"`,
    );
  }

  throw createError({
    statusCode: 401,
    statusMessage: "Unauthorized",
    message:
      "Invalid or missing credentials. Use Authorization: Bearer <MCP_API_KEY> or complete MCP OAuth.",
  });
}
