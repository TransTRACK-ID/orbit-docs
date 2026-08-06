import { defineEventHandler, getQuery, getHeader, createError, readBody } from "h3";
import { transports, checkMcpApiKey } from "~/server/utils/mcp-server";

export default defineEventHandler(async (event) => {
  // Pass through when MCP_API_KEY is unset (public). When it IS set, require a
  // matching key so existing remote clients must authenticate.
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "x-api-key");

  if (!checkMcpApiKey(authHeader, apiKeyHeader)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or missing API key. Provide it via Authorization: Bearer <key> or X-API-Key header.",
    });
  }

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

  const body = await readBody(event);
  await transport.handlePostMessage(event.node.req, event.node.res, body);
});
