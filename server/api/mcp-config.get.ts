import { defineEventHandler } from "h3";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const protocol = getRequestProtocol(event);
  const host = getRequestHost(event);
  
  // Priority: explicit MCP_HOST env var > inferred from request host
  const mcpHost = config.mcpHost || `mcp.${host}`;
  const mcpUrl = `${protocol}://${host}/api/mcp/connect`;
  
  return {
    data: {
      host: mcpHost,
      url: mcpUrl,
      protocol,
      // Whether the server thinks MCP is configured
      configured: !!config.mcpHost,
    },
  };
});
