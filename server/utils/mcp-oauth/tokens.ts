import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
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

// In-memory refresh token store (same simplicity as auth codes).
// A refresh token can be used once to get a new access + refresh token pair.
const refreshTokens = new Map<string, McpRefreshTokenPayload & { expiresAt: number }>();
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function purgeExpiredRefreshTokens(): void {
  const now = Date.now();
  for (const [token, record] of refreshTokens.entries()) {
    if (record.expiresAt <= now) {
      refreshTokens.delete(token);
    }
  }
}

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
  purgeExpiredRefreshTokens();
  const refreshToken = randomBytes(32).toString("base64url");
  refreshTokens.set(refreshToken, {
    ...payload,
    type: "mcp_refresh",
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
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
  purgeExpiredRefreshTokens();
  const record = refreshTokens.get(refreshToken);
  if (!record || record.expiresAt <= Date.now()) {
    return null;
  }

  // Rotate: delete old, issue new pair
  refreshTokens.delete(refreshToken);
  return issueMcpAccessToken(record.sub, record.scope);
}
