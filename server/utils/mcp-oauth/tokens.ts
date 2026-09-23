import jwt from "jsonwebtoken";
import {
  getMcpOAuthSigningSecret,
  getMcpOAuthTokenExpirySeconds,
  getMcpResourceUrl,
} from "./config";

export interface McpAccessTokenPayload {
  sub: string;
  aud: string;
  scope: string;
  type: "mcp_access";
}

export interface McpRefreshTokenPayload {
  sub: string;
  aud: string;
  scope: string;
  type: "mcp_refresh";
}

// Refresh tokens are stateless JWTs so they survive deploys/restarts and work
// across replicas. Trade-off: no server-side revocation — a refresh token
// stays valid until its expiry even after rotation issues a new pair.
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function issueMcpAccessToken(clientId: string, scope: string): {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
} {
  const expiresIn = getMcpOAuthTokenExpirySeconds();
  const payload: McpAccessTokenPayload = {
    sub: clientId,
    aud: getMcpResourceUrl(),
    scope,
    type: "mcp_access",
  };

  const accessToken = jwt.sign(payload, getMcpOAuthSigningSecret(), {
    expiresIn,
  });

  // Issue a refresh token so Google's account linking can persist the connection.
  const refreshPayload: McpRefreshTokenPayload = {
    ...payload,
    type: "mcp_refresh",
  };
  const refreshToken = jwt.sign(refreshPayload, getMcpOAuthSigningSecret(), {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });

  return { accessToken, expiresIn, refreshToken };
}

export function verifyMcpAccessToken(token: string): McpAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getMcpOAuthSigningSecret()) as McpAccessTokenPayload;
    if (decoded.type !== "mcp_access" || decoded.aud !== getMcpResourceUrl()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function refreshMcpAccessToken(refreshToken: string): {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
} | null {
  try {
    const decoded = jwt.verify(
      refreshToken,
      getMcpOAuthSigningSecret(),
    ) as McpRefreshTokenPayload;
    if (decoded.type !== "mcp_refresh" || decoded.aud !== getMcpResourceUrl()) {
      return null;
    }

    // Rotate: issue a new access + refresh token pair for the same subject.
    return issueMcpAccessToken(decoded.sub, decoded.scope);
  } catch {
    return null;
  }
}
