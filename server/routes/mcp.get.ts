import { defineEventHandler, getQuery, getHeader, createError, getRequestURL } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpServer, checkMcpApiKey, transports } from "~/server/utils/mcp-server";

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
  const messagePath = url.pathname + "/message";
  
  // Create SSE transport with Nitro's response
  const transport = new SSEServerTransport(messagePath, event.node.res);
  transports[transport.sessionId] = transport;
  
  // Clean up on close
  event.node.res.on("close", () => {
    delete transports[transport.sessionId];
  });
  
  // Connect the MCP server
  await mcpServer.connect(transport);
});
