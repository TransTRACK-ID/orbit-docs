import jwt from "jsonwebtoken";
import type { H3Event } from "h3";
import {
  getMcpOAuthSigningSecret,
  getMcpOAuthTokenExpirySeconds,
  resolveMcpOAuthContext,
} from "~/server/utils/mcp-oauth/config";

export interface McpAccessTokenPayload {
  sub: string;
  aud: string;
  scope: string;
  type: "mcp_access";
}

export function issueMcpAccessToken(
  clientId: string,
  scope: string,
  event?: H3Event,
): {
  accessToken: string;
  expiresIn: number;
} {
  const expiresIn = getMcpOAuthTokenExpirySeconds();
  const { resource } = resolveMcpOAuthContext(event);
  const payload: McpAccessTokenPayload = {
    sub: clientId,
    aud: resource,
    scope,
    type: "mcp_access",
  };

  const accessToken = jwt.sign(payload, getMcpOAuthSigningSecret(), {
    expiresIn,
  });

  return { accessToken, expiresIn };
}

export function verifyMcpAccessToken(token: string, event?: H3Event): boolean {
  try {
    const decoded = jwt.verify(token, getMcpOAuthSigningSecret()) as McpAccessTokenPayload;
    const { resource } = resolveMcpOAuthContext(event);
    return decoded.type === "mcp_access" && decoded.aud === resource;
  } catch {
    return false;
  }
}
