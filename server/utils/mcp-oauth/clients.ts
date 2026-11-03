import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  getConfiguredRedirectUris,
  getMcpOAuthClientId,
  getMcpOAuthClientSecret,
} from "./config";
import {
  findClientRecord,
  registerClientRecord,
  sha256Hex,
  type StoredClientRecord,
} from "./store";

interface ClientIdMetadataDocument {
  client_id?: string;
  redirect_uris?: string[];
}

export interface McpOAuthClient {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientName?: string;
  tokenEndpointAuthMethod: string;
}

// Dynamically registered clients (RFC 7591). In-memory like the auth-code
// store — after a restart clients re-register, which is automatic.
const registeredClients = new Map<string, McpOAuthClient>();

const cimdCache = new Map<string, { expiresAt: number; redirectUris: string[] }>();
const CIMD_CACHE_TTL_MS = 5 * 60 * 1000;

function isUrlClientId(clientId: string): boolean {
  return /^https?:\/\//i.test(clientId);
}

function isLoopbackRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "http:") {
      return false;
    }
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function isValidRegistrationRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") {
      return true;
    }
    if (url.protocol === "http:") {
      return isLoopbackRedirectUri(redirectUri);
    }
    // Native/desktop clients register private-use schemes (RFC 8252 §7.1),
    // e.g. cursor://… — allow any scheme except those that can execute or
    // leak content in a browser navigation.
    return !["javascript:", "data:", "file:", "vbscript:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isGoogleHostedRedirectUri(redirectUri: string): boolean {
  try {
    const hostname = new URL(redirectUri).hostname.toLowerCase();
    return (
      hostname === "google.com" ||
      hostname.endsWith(".google.com") ||
      hostname.endsWith(".googleapis.com") ||
      hostname.endsWith(".googleusercontent.com") ||
      hostname.endsWith(".gstatic.com")
    );
  } catch {
    return false;
  }
}

async function fetchCimdRedirectUris(clientIdUrl: string): Promise<string[]> {
  const cached = cimdCache.get(clientIdUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.redirectUris;
  }

  try {
    const response = await fetch(clientIdUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const document = (await response.json()) as ClientIdMetadataDocument;
    const redirectUris = Array.isArray(document.redirect_uris)
      ? document.redirect_uris.filter((uri): uri is string => typeof uri === "string")
      : [];

    cimdCache.set(clientIdUrl, {
      expiresAt: Date.now() + CIMD_CACHE_TTL_MS,
      redirectUris,
    });

    return redirectUris;
  } catch {
    // Network error, DNS failure, or blocked request — fall through to other checks.
    return [];
  }
}

export function validateStaticClientCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
): boolean {
  const expectedClientId = getMcpOAuthClientId();
  const expectedClientSecret = getMcpOAuthClientSecret();

  if (!expectedClientId || !expectedClientSecret || !clientId || !clientSecret) {
    return false;
  }

  return clientId === expectedClientId && clientSecret === expectedClientSecret;
}

export function resolveClient(clientId: string): McpOAuthClient | undefined {
  const registered = registeredClients.get(clientId);
  if (registered) {
    return registered;
  }

  const staticClientId = getMcpOAuthClientId();
  if (staticClientId && staticClientId === clientId) {
    return {
      clientId: staticClientId,
      clientSecret: getMcpOAuthClientSecret(),
      redirectUris: getConfiguredRedirectUris(),
      tokenEndpointAuthMethod: "client_secret_basic",
    };
  }

  // CIMD: the client_id is an https URL hosting the client metadata document.
  // These are public clients — PKCE is the only client authentication.
  if (isUrlClientId(clientId)) {
    return { clientId, redirectUris: [], tokenEndpointAuthMethod: "none" };
  }

  return undefined;
}

/**
 * RFC 7591 dynamic client registration. Returns the client record or an
 * error string when the metadata is invalid.
 */
export function registerClient(input: {
  redirectUris: string[];
  clientName?: string;
  tokenEndpointAuthMethod?: string;
}): McpOAuthClient | { error: string } {
  const redirectUris = input.redirectUris.filter(
    (uri): uri is string => typeof uri === "string" && uri.length > 0,
  );
  if (redirectUris.length === 0 || !redirectUris.every(isValidRegistrationRedirectUri)) {
    return {
      error:
        "redirect_uris must be non-empty https URIs (http allowed on localhost only)",
    };
  }

  const authMethod = input.tokenEndpointAuthMethod ?? "client_secret_basic";
  if (!["none", "client_secret_basic", "client_secret_post"].includes(authMethod)) {
    return { error: "unsupported token_endpoint_auth_method" };
  }

  const client: McpOAuthClient = {
    clientId: `mcp_${randomBytes(16).toString("hex")}`,
    clientSecret:
      authMethod === "none" ? undefined : randomBytes(32).toString("base64url"),
    redirectUris,
    clientName: input.clientName,
    tokenEndpointAuthMethod: authMethod,
  };
  registeredClients.set(client.clientId, client);
  return client;
}

/**
 * Confidential clients must prove their secret; public clients (dynamic
 * "none" registrations and CIMD URL client IDs) rely on PKCE alone.
 */
export function validateClientCredentials(
  clientId: string,
  clientSecret: string | undefined,
): boolean {
  const client = resolveClient(clientId);
  if (!client) {
    return false;
  }
  if (!client.clientSecret) {
    // Persisted confidential client loaded from the database: the plaintext
    // secret is not cached, so compare against its stored hash.
    const expectedHash = persistedSecretHashes.get(clientId);
    if (!expectedHash) return true;
    if (!clientSecret) return false;
    const provided = Buffer.from(sha256Hex(clientSecret), "utf8");
    const expected = Buffer.from(expectedHash, "utf8");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
  return client.clientSecret === clientSecret;
}

/**
 * Database-backed client resolution. The in-memory map stays the hot cache;
 * dynamically registered clients are persisted so they survive restarts and
 * work across replicas/processes (Nitro + standalone MCP server).
 */
const persistedSecretHashes = new Map<string, string>();

function cacheStoredRecord(record: StoredClientRecord): McpOAuthClient {
  const cached: McpOAuthClient = {
    clientId: record.clientId,
    clientSecret: undefined,
    redirectUris: record.redirectUris,
    clientName: record.clientName ?? undefined,
    tokenEndpointAuthMethod: record.tokenEndpointAuthMethod,
  };
  registeredClients.set(record.clientId, cached);
  if (record.clientSecretHash) {
    persistedSecretHashes.set(record.clientId, record.clientSecretHash);
  }
  return cached;
}

export async function resolveClientAsync(
  clientId: string,
): Promise<McpOAuthClient | undefined> {
  const memory = resolveClient(clientId);
  if (memory) return memory;
  try {
    const stored = await findClientRecord(clientId);
    if (!stored) return undefined;
    return cacheStoredRecord(stored);
  } catch {
    return undefined;
  }
}

/**
 * RFC 7591 registration persisted to the database. The returned secret (when
 * present) is shown exactly once — only its SHA-256 hash is stored.
 */
export async function registerClientPersistent(input: {
  redirectUris: string[];
  clientName?: string;
  tokenEndpointAuthMethod?: string;
}): Promise<McpOAuthClient & { secret: string | null } | { error: string }> {
  const validated = registerClient(input);
  if ("error" in validated) return validated;

  // Persist the same identity so every process agrees on it. The plaintext
  // secret lives only in this process's cache and the registration response;
  // the database keeps its SHA-256 hash.
  try {
    await registerClientRecord({
      clientId: validated.clientId,
      secret: validated.clientSecret ?? null,
      clientName: validated.clientName,
      redirectUris: validated.redirectUris,
      tokenEndpointAuthMethod: validated.tokenEndpointAuthMethod,
      publicClient: validated.tokenEndpointAuthMethod === "none",
    });
    if (validated.clientSecret) {
      persistedSecretHashes.set(validated.clientId, sha256Hex(validated.clientSecret));
    }
  } catch {
    // Database unavailable — the in-memory registration above still lets
    // local development without Postgres keep working.
  }
  return { ...validated, secret: validated.clientSecret ?? null };
}

/**
 * Confidential clients must prove their secret; public clients rely on PKCE.
 * Checks the in-memory cache first, then persisted registrations (comparing
 * hashes), then the static env client and CIMD public clients.
 */
export async function validateClientCredentialsAsync(
  clientId: string,
  clientSecret: string | undefined,
): Promise<boolean> {
  if (validateClientCredentials(clientId, clientSecret)) return true;

  let stored: StoredClientRecord | null = null;
  try {
    stored = await findClientRecord(clientId);
  } catch {
    return false;
  }
  if (!stored) return false;
  cacheStoredRecord(stored);
  if (!stored.clientSecretHash) return true;
  if (!clientSecret) return false;
  const provided = Buffer.from(sha256Hex(clientSecret), "utf8");
  const expected = Buffer.from(stored.clientSecretHash, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function isRedirectUriAllowedAsync(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  if (await isRedirectUriAllowed(clientId, redirectUri)) return true;
  try {
    const stored = await findClientRecord(clientId);
    if (!stored) return false;
    cacheStoredRecord(stored);
    if (stored.redirectUris.includes(redirectUri)) return true;
    if (!stored.clientSecretHash && isLoopbackRedirectUri(redirectUri)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function isRedirectUriAllowed(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  const configured = getConfiguredRedirectUris();
  if (configured.includes(redirectUri)) {
    return true;
  }

  const registered = registeredClients.get(clientId);
  if (registered) {
    if (registered.redirectUris.includes(redirectUri)) {
      return true;
    }
    // Public clients (native/desktop apps) may bind an ephemeral loopback
    // port they could not know at registration time (RFC 8252 §7.3).
    if (!registered.clientSecret && isLoopbackRedirectUri(redirectUri)) {
      return true;
    }
    return false;
  }

  const staticClientId = getMcpOAuthClientId();
  if (staticClientId && clientId === staticClientId && isGoogleHostedRedirectUri(redirectUri)) {
    return true;
  }

  if (isUrlClientId(clientId)) {
    const cimdRedirects = await fetchCimdRedirectUris(clientId);
    if (cimdRedirects.includes(redirectUri)) {
      return true;
    }
  }

  // Gemini Spark may use cross-origin Google redirect URIs with CIMD client IDs.
  if (isUrlClientId(clientId) && isGoogleHostedRedirectUri(redirectUri)) {
    return true;
  }

  return false;
}
