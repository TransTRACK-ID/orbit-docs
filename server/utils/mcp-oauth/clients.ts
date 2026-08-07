import {
  getConfiguredRedirectUris,
  getMcpOAuthClientId,
  getMcpOAuthClientSecret,
} from "~/server/utils/mcp-oauth/config";

interface ClientIdMetadataDocument {
  client_id?: string;
  redirect_uris?: string[];
}

const cimdCache = new Map<string, { expiresAt: number; redirectUris: string[] }>();
const CIMD_CACHE_TTL_MS = 5 * 60 * 1000;

function isUrlClientId(clientId: string): boolean {
  return /^https?:\/\//i.test(clientId);
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

export async function isRedirectUriAllowed(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  const configured = getConfiguredRedirectUris();
  if (configured.includes(redirectUri)) {
    return true;
  }

  const staticClientId = getMcpOAuthClientId();
  if (staticClientId && clientId === staticClientId && isGoogleHostedRedirectUri(redirectUri)) {
    return true;
  }

  if (isUrlClientId(clientId) && isGoogleHostedRedirectUri(redirectUri)) {
    return true;
  }

  if (isUrlClientId(clientId)) {
    const cimdRedirects = await fetchCimdRedirectUris(clientId);
    if (cimdRedirects.includes(redirectUri)) {
      return true;
    }
  }

  return false;
}
