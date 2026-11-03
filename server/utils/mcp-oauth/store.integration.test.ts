import { describe, it, expect } from "vitest";

/**
 * Database-backed grant lifecycle tests. They run only when a Postgres
 * connection string is available (POSTGRES_URL or DATABASE_URL) with the
 * mcp_oauth_* tables migrated — otherwise they skip.
 *
 *   POSTGRES_URL=postgres://... npm run test -- store.integration
 */
const hasDb = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);

describe.skipIf(!hasDb)("mcp oauth grant store", () => {
  it("runs the full pending -> code -> token -> refresh -> revoke lifecycle", async () => {
    const {
      createPendingRequest,
      consumePendingRequest,
      issueAuthorizationCode,
      consumeAuthorizationCode,
      issueRefreshToken,
      rotateRefreshToken,
      listUserGrants,
      revokeUserGrants,
    } = await import("./store");

    const requestId = await createPendingRequest({
      clientId: "mcp_test_client",
      clientName: "Test Client",
      redirectUri: "https://client.example.com/cb",
      state: "s1",
      scope: "mcp:read",
      codeChallenge: "challenge",
    });
    expect(requestId).toBeTruthy();

    // Second consumption loses the race: single-use.
    const first = await consumePendingRequest(requestId);
    expect(first?.clientId).toBe("mcp_test_client");
    expect(first?.state).toBe("s1");
    expect(await consumePendingRequest(requestId)).toBeNull();

    const code = await issueAuthorizationCode({
      clientId: "mcp_test_client",
      userId: "user-123",
      redirectUri: "https://client.example.com/cb",
      codeChallenge: "challenge",
      scope: "mcp:read",
    });
    const grant = await consumeAuthorizationCode(code);
    expect(grant?.userId).toBe("user-123");
    expect(await consumeAuthorizationCode(code)).toBeNull();

    const { token, familyId } = await issueRefreshToken({
      userId: "user-123",
      clientId: "mcp_test_client",
      scope: "mcp:read",
    });
    const rotated = await rotateRefreshToken(token);
    expect(rotated.status).toBe("rotated");
    if (rotated.status !== "rotated") return;
    expect(rotated.record.familyId).toBe(familyId);
    expect(rotated.record.userId).toBe("user-123");

    // Replaying the consumed token revokes the whole family.
    expect(await rotateRefreshToken(token)).toEqual({ status: "replay" });
    expect(await rotateRefreshToken(rotated.token)).toEqual({ status: "invalid" });

    // Fresh grant is listed, then revoked.
    const fresh = await issueRefreshToken({
      userId: "user-123",
      clientId: "mcp_test_client",
      scope: "mcp:read",
    });
    const grants = await listUserGrants("user-123");
    expect(grants.some((g) => g.familyId === fresh.familyId)).toBe(true);
    expect(await revokeUserGrants("user-123", fresh.familyId)).toBeGreaterThan(0);
    expect(await rotateRefreshToken(fresh.token)).toEqual({ status: "invalid" });
  });

  it("persists registered clients across lookups", async () => {
    const { registerClientRecord, findClientRecord, sha256Hex } = await import("./store");
    const { record, secret } = await registerClientRecord({
      clientName: "Persistent Client",
      redirectUris: ["https://client.example.com/cb"],
      tokenEndpointAuthMethod: "client_secret_basic",
      publicClient: false,
    });
    expect(record.clientId).toMatch(/^mcp_[0-9a-f]{32}$/);
    expect(secret).toBeTruthy();

    const found = await findClientRecord(record.clientId);
    expect(found?.redirectUris).toEqual(["https://client.example.com/cb"]);
    expect(found?.clientSecretHash).toBe(secret ? sha256Hex(secret) : null);
  });
});
