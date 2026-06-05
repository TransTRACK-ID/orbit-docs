import { defineEventHandler, getHeader, createError } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer, checkMcpApiKey, transports } from "~/server/utils/mcp-server";

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");
  
  if (!checkMcpApiKey(authHeader, apiKeyHeader)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or missing API key. Provide it via Authorization: Bearer <key> or X-API-Key header.",
    });
  }

  const res = event.node.res;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  
  const messagePath = "/api/mcp/message";
  
  const transport = new SSEServerTransport(messagePath, res);
  transports[transport.sessionId] = transport;
  
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  
  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);
});