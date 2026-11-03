import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { issueMcpAccessToken, verifyMcpAccessToken } from "./tokens";

describe("issueMcpAccessToken", () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_ISSUER = "https://orbit.example.com";
    process.env.MCP_OAUTH_SIGNING_SECRET = "test-signing-secret-for-unit-tests";
    process.env.MCP_OAUTH_TOKEN_EXPIRY = "3600";
  });

  afterEach(() => {
    delete process.env.MCP_OAUTH_ISSUER;
    delete process.env.MCP_OAUTH_SIGNING_SECRET;
    delete process.env.MCP_OAUTH_TOKEN_EXPIRY;
  });

  it("binds the token to the user, not the client", () => {
    const { accessToken, expiresIn } = issueMcpAccessToken({
      userId: "user-123",
      clientId: "mcp_abc",
      scope: "mcp:read",
    });
    expect(expiresIn).toBe(3600);

    const payload = verifyMcpAccessToken(accessToken);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-123");
    expect(payload?.client_id).toBe("mcp_abc");
    expect(payload?.scope).toBe("mcp:read");
    expect(payload?.aud).toBe("https://orbit.example.com/api/mcp/connect");
  });

  it("rejects legacy client-subject tokens without a client_id claim", () => {
    const legacy = jwt.sign(
      {
        sub: "mcp_abc",
        aud: "https://orbit.example.com/api/mcp/connect",
        scope: "mcp:read",
        type: "mcp_access",
      },
      "test-signing-secret-for-unit-tests",
      { expiresIn: 3600 },
    );
    expect(verifyMcpAccessToken(legacy)).toBeNull();
  });

  it("rejects tokens for another resource or signed with another secret", () => {
    const { accessToken } = issueMcpAccessToken({
      userId: "user-123",
      clientId: "mcp_abc",
      scope: "mcp:read",
    });
    expect(verifyMcpAccessToken(accessToken + "tampered")).toBeNull();

    const wrongAud = jwt.sign(
      {
        sub: "user-123",
        client_id: "mcp_abc",
        aud: "https://evil.example.com/api/mcp/connect",
        scope: "mcp:read",
        type: "mcp_access",
      },
      "test-signing-secret-for-unit-tests",
      { expiresIn: 3600 },
    );
    expect(verifyMcpAccessToken(wrongAud)).toBeNull();
  });
});
