import { defineEventHandler, setResponseStatus, setResponseHeaders, getRequestHeader } from "h3";
import { getCorsHeaders } from "~/server/utils/cors";

/**
 * Handle CORS preflight (OPTIONS) for all /api routes.
 * Without this, Nitro falls through to the SPA page fallback, which returns
 * the HTML shell with Content-Type: text/html — breaking clients (e.g. n8n's
 * MCP client) that expect a streamable/JSON response and validate Content-Type.
 */
export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, "origin");
  const headers = getCorsHeaders(origin);

  setResponseStatus(event, 204);
  setResponseHeaders(event, headers);
  return null;
});