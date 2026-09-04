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

export function issueMcpAccessToken(clientId: string, scope: string): {
  accessToken: string;
  expiresIn: number;
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

  return { accessToken, expiresIn };
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
