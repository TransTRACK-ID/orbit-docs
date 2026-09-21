import { randomBytes } from "node:crypto";
import {
  getConfiguredRedirectUris,
  getMcpOAuthClientId,
  getMcpOAuthClientSecret,
} from "./config";

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
    return true;
  }
  return client.clientSecret === clientSecret;
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
