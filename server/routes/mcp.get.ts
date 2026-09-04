import { defineEventHandler } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer, transports } from "~/server/utils/mcp-server";
import { assertMcpAuth } from "~/server/utils/mcp-streamable-http";

export default defineEventHandler(async (event) => {
  assertMcpAuth(event);

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
  
  const mcpServer = await createMcpServer();
  await mcpServer.connect(transport);
});