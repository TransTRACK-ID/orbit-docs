import { defineEventHandler, getQuery, createError, readBody } from "h3";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { transports } from "~/server/utils/mcp-server";
import { assertMcpAuth, assertSessionPrincipal } from "~/server/utils/mcp-streamable-http";

export default defineEventHandler(async (event) => {
  const principal = await assertMcpAuth(event);

  const query = getQuery(event);
  const sessionId = query.sessionId as string;
  const transport = transports[sessionId];

  if (!transport) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "No transport found for sessionId",
    });
  }

  assertSessionPrincipal(sessionId, principal);

  if (!(transport instanceof SSEServerTransport)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Session exists but uses a different transport protocol",
    });
  }

  const body = await readBody(event);
  await transport.handlePostMessage(event.node.req, event.node.res, body);
});
