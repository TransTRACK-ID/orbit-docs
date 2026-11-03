import jwt from "jsonwebtoken";
import {
  getMcpOAuthSigningSecret,
  getMcpOAuthTokenExpirySeconds,
  getMcpResourceUrl,
} from "./config";

/**
 * MCP access tokens are bound to the workspace user who approved consent:
 * `sub` is the user's id, `client_id` identifies the OAuth client the token
 * was issued to. Callers must re-check the user against the database (active
 * membership, current role) on every use — the JWT alone is not authority.
 */
export interface McpAccessTokenPayload {
  sub: string;
  client_id: string;
  aud: string;
  scope: string;
  type: "mcp_access";
}

export function issueMcpAccessToken(input: {
  userId: string;
  clientId: string;
  scope: string;
}): {
  accessToken: string;
  expiresIn: number;
} {
  const expiresIn = getMcpOAuthTokenExpirySeconds();
  const payload: McpAccessTokenPayload = {
    sub: input.userId,
    client_id: input.clientId,
    aud: getMcpResourceUrl(),
    scope: input.scope,
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
    if (
      decoded.type !== "mcp_access" ||
      decoded.aud !== getMcpResourceUrl() ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      typeof decoded.client_id !== "string" ||
      !decoded.client_id
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
