/**
 * CORS (Cross-Origin Resource Sharing) Plugin
 * Adds CORS headers to API routes to prevent unauthorized cross-origin requests (M1).
 * In production, restrict to the configured public app URL.
 * CORS preflight (OPTIONS) is short-circuited by `server/api/[...].options.ts`.
 */

import { getCorsHeaders } from "~/server/utils/cors";

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

    const origin = getRequestHeader(event, 'origin') || undefined;
    const headers = getCorsHeaders(origin);

    for (const [key, value] of Object.entries(headers)) {
      event.node.res.setHeader(key, value);
    }
  });
});