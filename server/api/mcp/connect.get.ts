import { defineEventHandler, getHeader, createError, getRequestURL } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer, checkMcpApiKey, transports } from "~/server/utils/mcp-server";

export default defineEventHandler(async (event) => {
  // Check API key
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");
  
  if (!checkMcpApiKey(authHeader, apiKeyHeader)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or missing API key. Provide it via Authorization: Bearer <key> or X-API-Key header.",
    });
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
  
  // Clean up on close
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  
  // Create a new MCP server instance for this connection
  const mcpServer = createMcpServer();
  
  // Connect the MCP server
  await mcpServer.connect(transport);
});
