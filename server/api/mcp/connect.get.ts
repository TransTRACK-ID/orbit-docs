import { defineEventHandler, getHeader, getRequestURL } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  createMcpServer,
  mcpSessionPrincipals,
  transports,
} from "~/server/utils/mcp-server";
import { principalFingerprint } from "~/server/utils/mcp-principal";
import { assertMcpAuth, assertSessionPrincipal, handleStreamableHttpRequest } from "~/server/utils/mcp-streamable-http";

export default defineEventHandler(async (event) => {
  const principal = await assertMcpAuth(event);

  // Streamable HTTP clients open an SSE stream with GET + mcp-session-id.
  if (getHeader(event, "mcp-session-id")) {
    await handleStreamableHttpRequest(event);
    return;
  }

  // Get the request URL to determine the message endpoint
  const url = getRequestURL(event);
  const messagePath = url.pathname.replace(/\/$/, "").replace(/\/connect$/, "") + "/message";

  // Set SSE headers on the raw Node response
  const res = event.node.res;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Create SSE transport with the raw response
  const transport = new SSEServerTransport(messagePath, res);
  transports[transport.sessionId] = transport;
  mcpSessionPrincipals[transport.sessionId] = principalFingerprint(principal);

  // Clean up on close
  res.on("close", () => {
    delete transports[transport.sessionId];
    delete mcpSessionPrincipals[transport.sessionId];
  });

  // Create a new MCP server instance for this connection, scoped to the caller
  const mcpServer = await createMcpServer(principal);

  // Connect the MCP server
  await mcpServer.connect(transport);
});
