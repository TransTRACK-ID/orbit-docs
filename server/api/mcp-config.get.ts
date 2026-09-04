import { defineEventHandler } from "h3";
import { getMcpHost } from "~/server/utils/runtime-env";
import { isMcpOAuthEnabled } from "~/server/utils/mcp-oauth/config";

export default defineEventHandler((event) => {
  const protocol = getRequestProtocol(event);
  const host = getRequestHost(event);

  // Priority: explicit MCP_HOST env var > inferred from request host
  const configuredMcpHost = getMcpHost();
  const mcpHost = configuredMcpHost || `mcp.${host}`;
  const mcpUrl = `${protocol}://${host}${withBaseURL('/api/mcp/connect')}`;

  return {
    data: {
      host: mcpHost,
      url: mcpUrl,
      protocol,
      // Whether the server thinks MCP is configured
      configured: !!configuredMcpHost,
      // When MCP_API_KEY is set, remote clients must send Authorization: Bearer <key>
      authRequired: !!process.env.MCP_API_KEY,
      // When MCP OAuth is enabled, clients can use OAuth 2.0 + PKCE instead of a static key
      oauthEnabled: isMcpOAuthEnabled(),
    },
  };
});
