import { defineEventHandler } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  createMcpServer,
  mcpSessionPrincipals,
  transports,
} from "~/server/utils/mcp-server";
import { principalFingerprint } from "~/server/utils/mcp-principal";
import { assertMcpAuth } from "~/server/utils/mcp-streamable-http";

export default defineEventHandler(async (event) => {
  const principal = await assertMcpAuth(event);

  const res = event.node.res;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const messagePath = "/api/mcp/message";

  const transport = new SSEServerTransport(messagePath, res);
  transports[transport.sessionId] = transport;
  mcpSessionPrincipals[transport.sessionId] = principalFingerprint(principal);

  res.on("close", () => {
    delete transports[transport.sessionId];
    delete mcpSessionPrincipals[transport.sessionId];
  });

  const mcpServer = await createMcpServer(principal);
  await mcpServer.connect(transport);
});
