import type { H3Event } from "h3";
import { getHeader, readBody, createError, setResponseHeaders } from "h3";
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  createMcpServer,
  mcpSessionPrincipals,
  transports,
} from "~/server/utils/mcp-server";
import {
  principalFingerprint,
  resolveMcpPrincipal,
  type McpPrincipal,
} from "~/server/utils/mcp-principal";
import { InMemoryEventStore } from "~/server/utils/mcp-event-store";
import { isMcpOAuthEnabled, getProtectedResourceMetadataUrl } from "~/server/utils/mcp-oauth/config";

/**
 * MCP session expiry. Streamable HTTP sessions are resumable by design, so a
 * client that simply disappears (closed laptop, killed agent) never sends
 * DELETE and its transport, McpServer instance, event store, and principal
 * binding stay in `transports` forever — unbounded memory growth across
 * every agent connection the server ever serves. Track last activity per
 * session and close sessions idle beyond the TTL; clients re-initialize.
 */
const SESSION_IDLE_TTL_MS = (() => {
  const parsed = Number(process.env.MCP_SESSION_IDLE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30 * 60 * 1000;
})();
const sessionLastSeenAt = new Map<string, number>();
let sessionSweeperStarted = false;

export function trackMcpSessionActivity(sessionId: string): void {
  sessionLastSeenAt.set(sessionId, Date.now());
  if (!sessionSweeperStarted) {
    sessionSweeperStarted = true;
    const sweeper = setInterval(async () => {
      const now = Date.now();
      for (const [sid, lastSeen] of sessionLastSeenAt) {
        if (now - lastSeen <= SESSION_IDLE_TTL_MS) continue;
        sessionLastSeenAt.delete(sid);
        const transport = transports[sid];
        delete transports[sid];
        delete mcpSessionPrincipals[sid];
        try {
          await transport?.close?.();
        } catch {
          // Already removed from every map; a failed close must not leak back.
        }
      }
    }, 5 * 60 * 1000);
    sweeper.unref?.();
  }
}

export function stopTrackingMcpSession(sessionId: string): void {
  sessionLastSeenAt.delete(sessionId);
}

export async function assertMcpAuth(event: H3Event): Promise<McpPrincipal> {
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");

  const principal = await resolveMcpPrincipal(authHeader, apiKeyHeader);
  if (!principal) {
    // When OAuth is enabled, advertise the protected resource metadata URL
    // so MCP clients (Gemini Spark, etc.) can discover the OAuth flow.
    if (isMcpOAuthEnabled()) {
      setResponseHeaders(event, {
        "WWW-Authenticate": `Bearer [REDACTED]"mcp", resource_metadata="${getProtectedResourceMetadataUrl()}", scope="mcp:read"`,
      });
    }
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or missing credentials. Connect with OAuth, or provide the API key via Authorization: Bearer <key> or X-API-Key header.",
    });
  }
  return principal;
}

/**
 * Sessions are bound to the principal that created them: a token swap
 * mid-session (different user, or API key vs OAuth) is rejected instead of
 * silently changing whose data the tools read.
 */
export function assertSessionPrincipal(sessionId: string, principal: McpPrincipal): void {
  const fingerprint = principalFingerprint(principal);
  const bound = mcpSessionPrincipals[sessionId];
  if (!bound) {
    mcpSessionPrincipals[sessionId] = fingerprint;
    return;
  }
  if (bound !== fingerprint) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "This MCP session belongs to a different user. Start a new session with your own credentials.",
    });
  }
}

function sendJsonRpcError(res: ServerResponse, status: number, message: string) {
  if (res.headersSent) {
    return;
  }

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    }),
  );
}

/**
 * Handle MCP Streamable HTTP requests (GET / POST / DELETE) on /api/mcp/connect.
 */
export async function handleStreamableHttpRequest(event: H3Event, parsedBody?: unknown) {
  const principal = await assertMcpAuth(event);

  const req = event.node.req;
  const res = event.node.res;
  const method = event.method.toUpperCase();
  const sessionId = getHeader(event, "mcp-session-id");
  const body =
    parsedBody !== undefined
      ? parsedBody
      : method === "POST"
        ? await readBody(event)
        : undefined;

  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    trackMcpSessionActivity(sessionId);
    const existing = transports[sessionId];
    if (!(existing instanceof StreamableHTTPServerTransport)) {
      sendJsonRpcError(res, 400, "Bad Request: Session exists but uses a different transport protocol");
      return;
    }
    assertSessionPrincipal(sessionId, principal);
    transport = existing;
  } else if (!sessionId && method === "POST" && isInitializeRequest(body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
        mcpSessionPrincipals[sid] = principalFingerprint(principal);
        trackMcpSessionActivity(sid);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) {
        delete transports[sid];
      }
      if (sid) {
        delete mcpSessionPrincipals[sid];
        stopTrackingMcpSession(sid);
      }
    };

    const mcpServer = await createMcpServer(principal);
    await mcpServer.connect(transport);
  } else if (sessionId) {
    // Unknown/expired session (idle sessions are reaped after the TTL).
    // 404 per MCP spec: the client must start a new session with Initialize.
    sendJsonRpcError(res, 404, "Session not found or expired");
    return;
  } else {
    sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
    return;
  }

  await transport.handleRequest(req, res, body);
}
