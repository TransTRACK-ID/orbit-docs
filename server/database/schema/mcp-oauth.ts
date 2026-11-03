import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * MCP OAuth 2.0 grants bound to real workspace users.
 *
 * Every authorization code and refresh token records the `user_id` of the
 * signed-in user who approved the consent screen. Access tokens are short-lived
 * JWTs with `sub = user_id`; the database is re-checked on every MCP
 * connection so role changes, deactivation, and revocation take effect
 * without waiting for token expiry.
 */
export const mcpOAuthClients = pgTable("mcp_oauth_clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().unique(),
  clientName: text("client_name"),
  // JSON-encoded string array of registered redirect URIs.
  redirectUris: text("redirect_uris").notNull().default("[]"),
  // SHA-256 hex of the client secret. NULL for public clients
  // (token_endpoint_auth_method "none", PKCE only).
  clientSecretHash: text("client_secret_hash"),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method").notNull().default("client_secret_basic"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Short-lived pending authorization requests created by /oauth/authorize. */
export const mcpOAuthPendingRequests = pgTable("mcp_oauth_pending_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  requestId: text("request_id").notNull().unique(),
  clientId: text("client_id").notNull(),
  clientName: text("client_name"),
  redirectUri: text("redirect_uri").notNull(),
  state: text("state"),
  scope: text("scope").notNull().default("mcp:read"),
  codeChallenge: text("code_challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Single-use authorization codes. Only the SHA-256 hash is stored. */
export const mcpOAuthCodes = pgTable("mcp_oauth_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  codeHash: text("code_hash").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scope: text("scope").notNull().default("mcp:read"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Refresh token families. Tokens rotate single-use: each refresh consumes the
 * presented token and issues a new pair in the same family. Re-presenting an
 * already-consumed token revokes the whole family (replay protection).
 */
export const mcpOAuthRefreshTokens = pgTable("mcp_oauth_refresh_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenHash: text("token_hash").notNull().unique(),
  familyId: text("family_id").notNull(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(),
  scope: text("scope").notNull().default("mcp:read"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** API-key based service principals. Restricted to published content. */
export const mcpServicePrincipals = pgTable("mcp_service_principals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // SHA-256 hex of the API key. NULL marks the legacy env MCP_API_KEY entry.
  keyHash: text("key_hash").unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
