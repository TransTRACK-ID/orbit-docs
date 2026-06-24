/**
 * CORS (Cross-Origin Resource Sharing) Plugin
 * Adds CORS headers to API routes to prevent unauthorized cross-origin requests (M1).
 * In production, restrict to the configured public app URL.
 */

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

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    // Skip if response headers have already been sent to the client
    if (event.node.res.headersSent) {
      return;
    }

    const path = event.path || '';

    // Only apply CORS to API routes
    if (!path.startsWith('/api/')) {
      return;
    }

    const origin = getRequestHeader(event, 'origin') || '';
    const publicUrl = getPublicAppUrl();

    // Add configured public URL to allowed origins
    if (publicUrl) {
      ALLOWED_ORIGINS.add(publicUrl);
      // Also add https variant if only http is set
      if (publicUrl.startsWith('http://')) {
        ALLOWED_ORIGINS.add(publicUrl.replace('http://', 'https://'));
      }
    }

    // Allow same-origin requests (no origin header) or explicitly allowed origins
    const isAllowed =
      !origin ||
      ALLOWED_ORIGINS.has(origin) ||
      origin.endsWith('.orbit.local') ||
      isWildcardAllowed(origin);

    if (isAllowed && origin) {
      event.node.res.setHeader('Access-Control-Allow-Origin', origin);
      event.node.res.setHeader('Vary', 'Origin');
    }

    event.node.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    event.node.res.setHeader('Access-Control-Allow-Credentials', 'true');
    event.node.res.setHeader('Access-Control-Max-Age', '86400');
  });
});
