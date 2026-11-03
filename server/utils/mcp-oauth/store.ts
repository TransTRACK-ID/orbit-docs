import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
// Relative imports only: this module also runs in the standalone Express MCP
// server (Dockerfile.mcp copies server/utils/mcp-oauth + server/database/schema).
import { getDb } from "../../database";
import {
  mcpOAuthClients,
  mcpOAuthCodes,
  mcpOAuthPendingRequests,
  mcpOAuthRefreshTokens,
} from "../../database/schema";

export const PENDING_REQUEST_TTL_MS = 10 * 60 * 1000;
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}

export interface PendingAuthorizationRecord {
  requestId: string;
  clientId: string;
  clientName: string | null;
  redirectUri: string;
  state: string | null;
  scope: string;
  codeChallenge: string;
  expiresAt: Date;
}

export interface AuthorizationCodeRecord {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}

export interface RefreshTokenRecord {
  familyId: string;
  clientId: string;
  userId: string;
  scope: string;
}

export interface StoredClientRecord {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  /** SHA-256 hex of the client secret, or null for public clients. */
  clientSecretHash: string | null;
  tokenEndpointAuthMethod: string;
}

function parseRedirectUris(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((uri): uri is string => typeof uri === "string")
      : [];
  } catch {
    return [];
  }
}

export async function createPendingRequest(input: {
  clientId: string;
  clientName?: string | null;
  redirectUri: string;
  state?: string | null;
  scope: string;
  codeChallenge: string;
}): Promise<string> {
  const db = getDb();
  const requestId = randomToken(24);
  await db.insert(mcpOAuthPendingRequests).values({
    id: crypto.randomUUID(),
    requestId,
    clientId: input.clientId,
    clientName: input.clientName ?? null,
    redirectUri: input.redirectUri,
    state: input.state ?? null,
    scope: input.scope,
    codeChallenge: input.codeChallenge,
    expiresAt: new Date(Date.now() + PENDING_REQUEST_TTL_MS),
  });
  return requestId;
}

export async function loadPendingRequest(
  requestId: string,
): Promise<PendingAuthorizationRecord | null> {
  if (!requestId) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpOAuthPendingRequests)
    .where(eq(mcpOAuthPendingRequests.requestId, requestId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (isExpired(row.expiresAt)) {
    await db
      .delete(mcpOAuthPendingRequests)
      .where(eq(mcpOAuthPendingRequests.requestId, requestId));
    return null;
  }
  return {
    requestId: row.requestId,
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUri: row.redirectUri,
    state: row.state,
    scope: row.scope,
    codeChallenge: row.codeChallenge,
    expiresAt: row.expiresAt as Date,
  };
}

/**
 * Single-use consumption of a pending request. Concurrent approve/deny clicks
 * race on the DELETE: only the first caller gets the record back.
 */
export async function consumePendingRequest(
  requestId: string,
): Promise<PendingAuthorizationRecord | null> {
  if (!requestId) return null;
  const db = getDb();
  const deleted = await db
    .delete(mcpOAuthPendingRequests)
    .where(eq(mcpOAuthPendingRequests.requestId, requestId))
    .returning();
  const row = deleted[0];
  if (!row || isExpired(row.expiresAt)) return null;
  return {
    requestId: row.requestId,
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUri: row.redirectUri,
    state: row.state,
    scope: row.scope,
    codeChallenge: row.codeChallenge,
    expiresAt: row.expiresAt as Date,
  };
}

export async function issueAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): Promise<string> {
  const db = getDb();
  const code = randomToken(32);
  await db.insert(mcpOAuthCodes).values({
    id: crypto.randomUUID(),
    codeHash: sha256Hex(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
}

export async function consumeAuthorizationCode(
  code: string,
): Promise<AuthorizationCodeRecord | null> {
  if (!code) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpOAuthCodes)
    .where(eq(mcpOAuthCodes.codeHash, sha256Hex(code)))
    .limit(1);
  const row = rows[0];
  if (!row || row.usedAt || isExpired(row.expiresAt)) {
    if (row) {
      await db.delete(mcpOAuthCodes).where(eq(mcpOAuthCodes.id, row.id));
    }
    return null;
  }
  await db
    .update(mcpOAuthCodes)
    .set({ usedAt: new Date() })
    .where(eq(mcpOAuthCodes.id, row.id));
  return {
    clientId: row.clientId,
    userId: row.userId,
    redirectUri: row.redirectUri,
    codeChallenge: row.codeChallenge,
    scope: row.scope,
  };
}

export async function registerClientRecord(input: {
  clientName?: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  publicClient: boolean;
  /** Explicit identity for callers that already generated one (cache + DB agree). */
  clientId?: string;
  secret?: string | null;
}): Promise<{ record: StoredClientRecord; secret: string | null }> {
  const db = getDb();
  const clientId = input.clientId ?? `mcp_${randomBytes(16).toString("hex")}`;
  const secret = input.secret !== undefined ? input.secret : input.publicClient ? null : randomToken(32);
  const [row] = await db
    .insert(mcpOAuthClients)
    .values({
      id: crypto.randomUUID(),
      clientId,
      clientName: input.clientName ?? null,
      redirectUris: JSON.stringify(input.redirectUris),
      clientSecretHash: secret ? sha256Hex(secret) : null,
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    })
    .returning();
  if (!row) throw new Error("Failed to persist OAuth client registration.");
  return {
    record: {
      clientId: row.clientId,
      clientName: row.clientName,
      redirectUris: parseRedirectUris(row.redirectUris),
      clientSecretHash: row.clientSecretHash,
      tokenEndpointAuthMethod: row.tokenEndpointAuthMethod,
    },
    secret,
  };
}

export async function findClientRecord(
  clientId: string,
): Promise<StoredClientRecord | null> {
  if (!clientId) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpOAuthClients)
    .where(eq(mcpOAuthClients.clientId, clientId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUris: parseRedirectUris(row.redirectUris),
    clientSecretHash: row.clientSecretHash,
    tokenEndpointAuthMethod: row.tokenEndpointAuthMethod,
  };
}

export async function issueRefreshToken(input: {
  userId: string;
  clientId: string;
  scope: string;
  familyId?: string;
}): Promise<{ token: string; familyId: string }> {
  const db = getDb();
  const token = randomToken(32);
  const familyId = input.familyId ?? randomToken(16);
  await db.insert(mcpOAuthRefreshTokens).values({
    id: crypto.randomUUID(),
    tokenHash: sha256Hex(token),
    familyId,
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return { token, familyId };
}

export type RotateRefreshTokenResult =
  | { status: "rotated"; record: RefreshTokenRecord; token: string }
  | { status: "invalid" }
  | { status: "replay" };

/**
 * Single-use refresh rotation. A replayed (already-used) token revokes the
 * whole family so a stolen refresh token cannot be re-exchanged.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<RotateRefreshTokenResult> {
  if (!token) return { status: "invalid" };
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpOAuthRefreshTokens)
    .where(eq(mcpOAuthRefreshTokens.tokenHash, sha256Hex(token)))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || isExpired(row.expiresAt)) return { status: "invalid" };

  if (row.usedAt) {
    await db
      .update(mcpOAuthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(mcpOAuthRefreshTokens.familyId, row.familyId));
    return { status: "replay" };
  }

  await db
    .update(mcpOAuthRefreshTokens)
    .set({ usedAt: new Date() })
    .where(eq(mcpOAuthRefreshTokens.id, row.id));

  const next = await issueRefreshToken({
    userId: row.userId,
    clientId: row.clientId,
    scope: row.scope,
    familyId: row.familyId,
  });
  return {
    status: "rotated",
    record: {
      familyId: row.familyId,
      clientId: row.clientId,
      userId: row.userId,
      scope: row.scope,
    },
    token: next.token,
  };
}

export interface UserGrantSummary {
  familyId: string;
  clientId: string;
  clientName: string | null;
  scope: string;
  createdAt: Date | null;
}

export async function listUserGrants(userId: string): Promise<UserGrantSummary[]> {
  if (!userId) return [];
  const db = getDb();
  const rows = await db
    .select({
      familyId: mcpOAuthRefreshTokens.familyId,
      clientId: mcpOAuthRefreshTokens.clientId,
      scope: mcpOAuthRefreshTokens.scope,
      createdAt: mcpOAuthRefreshTokens.createdAt,
      clientName: mcpOAuthClients.clientName,
    })
    .from(mcpOAuthRefreshTokens)
    .leftJoin(mcpOAuthClients, eq(mcpOAuthClients.clientId, mcpOAuthRefreshTokens.clientId))
    .where(
      and(
        eq(mcpOAuthRefreshTokens.userId, userId),
        isNull(mcpOAuthRefreshTokens.revokedAt),
      ),
    );
  const byFamily = new Map<string, UserGrantSummary>();
  for (const row of rows) {
    const existing = byFamily.get(row.familyId);
    if (!existing || (row.createdAt && existing.createdAt && row.createdAt < existing.createdAt)) {
      byFamily.set(row.familyId, {
        familyId: row.familyId,
        clientId: row.clientId,
        clientName: row.clientName,
        scope: row.scope,
        createdAt: row.createdAt,
      });
    }
  }
  return [...byFamily.values()];
}

export async function revokeUserGrants(userId: string, familyId?: string): Promise<number> {
  if (!userId) return 0;
  const db = getDb();
  const conditions = familyId
    ? and(
        eq(mcpOAuthRefreshTokens.userId, userId),
        eq(mcpOAuthRefreshTokens.familyId, familyId),
        isNull(mcpOAuthRefreshTokens.revokedAt),
      )
    : and(
        eq(mcpOAuthRefreshTokens.userId, userId),
        isNull(mcpOAuthRefreshTokens.revokedAt),
      );
  const revoked = await db
    .update(mcpOAuthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(conditions)
    .returning({ id: mcpOAuthRefreshTokens.id });
  // Access tokens are short-lived JWTs; they expire on their own within the hour.
  return revoked.length;
}

/** Best-effort cleanup of expired grants. Safe to call without awaiting. */
export async function cleanupExpiredGrants(): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();
    await db
      .delete(mcpOAuthPendingRequests)
      .where(lte(mcpOAuthPendingRequests.expiresAt, now));
    await db.delete(mcpOAuthCodes).where(lte(mcpOAuthCodes.expiresAt, now));
    await db
      .delete(mcpOAuthRefreshTokens)
      .where(lte(mcpOAuthRefreshTokens.expiresAt, now));
  } catch {
    // Non-critical maintenance; never fail requests over it.
  }
}
