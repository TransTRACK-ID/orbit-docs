import { getPublicAppUrl } from "~/server/utils/runtime-env";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://localhost:3000",
]);

const ALLOWED_WILDCARD_DOMAINS = [
  ".transtrack.id",
  ".transtrack.co",
  ".transtrack.ai",
];

function isWildcardAllowed(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return ALLOWED_WILDCARD_DOMAINS.some((domain) => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Resolve the CORS headers for a given Origin header.
 * Returns null when the origin is not allowed (or absent / same-origin).
 * Returns the response headers (without status) otherwise.
 */
export function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const publicUrl = getPublicAppUrl();
  const allowedOrigins = new Set(ALLOWED_ORIGINS);
  if (publicUrl) {
    allowedOrigins.add(publicUrl);
    if (publicUrl.startsWith("http://")) {
      allowedOrigins.add(publicUrl.replace("http://", "https://"));
    }
  }

  // Allow same-origin requests (no origin header) or explicitly allowed origins
  const isAllowed =
    !origin ||
    allowedOrigins.has(origin) ||
    origin.endsWith(".orbit.local") ||
    isWildcardAllowed(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };

  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}
