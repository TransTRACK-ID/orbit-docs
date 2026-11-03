const CONSENT_REQUEST_KEY = "orbit_oauth_request_id";

function appBase(): string {
  try {
    const base = useRuntimeConfig().app.baseURL as string;
    return !base || base === "/" ? "" : base.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/** Consent page URL, honoring a subpath deployment (e.g. /docs). */
export function oauthConsentUrl(requestId: string): string {
  return `${appBase()}/oauth/consent?request_id=${encodeURIComponent(requestId)}`;
}

/**
 * Keeps a pending MCP authorization request across the login round trip so
 * the user lands back on the consent screen instead of the default page.
 */
export function rememberConsentRequest(requestId: string) {
  if (!import.meta.client || !requestId) return;
  sessionStorage.setItem(CONSENT_REQUEST_KEY, requestId);
}

export function takeConsentRedirect(): string | null {
  if (!import.meta.client) return null;
  const requestId = sessionStorage.getItem(CONSENT_REQUEST_KEY);
  sessionStorage.removeItem(CONSENT_REQUEST_KEY);
  return requestId ? oauthConsentUrl(requestId) : null;
}

export function peekConsentRedirect(): string | null {
  if (!import.meta.client) return null;
  const requestId = sessionStorage.getItem(CONSENT_REQUEST_KEY);
  return requestId ? oauthConsentUrl(requestId) : null;
}
