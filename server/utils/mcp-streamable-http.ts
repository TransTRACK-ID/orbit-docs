import type { H3Event } from "h3";
import { getHeader, readBody, createError } from "h3";
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer, checkMcpApiKey, transports } from "~/server/utils/mcp-server";
import { InMemoryEventStore } from "~/server/utils/mcp-event-store";

export function assertMcpAuth(event: H3Event) {
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");

  if (!checkMcpApiKey(authHeader, apiKeyHeader)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or missing API key. Provide it via Authorization: Bearer <key> or X-API-Key header.",
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
  assertMcpAuth(event);

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
    const existing = transports[sessionId];
    if (!(existing instanceof StreamableHTTPServerTransport)) {
      sendJsonRpcError(res, 400, "Bad Request: Session exists but uses a different transport protocol");
      return;
    }
    transport = existing;
  } else if (!sessionId && method === "POST" && isInitializeRequest(body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) {
        delete transports[sid];
      }
    };

    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
  } else {
    sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
    return;
  }

  await transport.handleRequest(req, res, body);
}
