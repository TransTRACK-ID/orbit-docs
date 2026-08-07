import { defineEventHandler } from "h3";
import { getMcpHost } from "~/server/utils/runtime-env";
import { isMcpOAuthEnabled } from "~/server/utils/mcp-oauth/config";

export default defineEventHandler((event) => {
  const protocol = getRequestProtocol(event);
  const host = getRequestHost(event);

  const configuredMcpHost = getMcpHost();
  const mcpHost = configuredMcpHost || `mcp.${host}`;
  const mcpUrl = `${protocol}://${host}${withBaseURL("/api/mcp/connect")}`;
  const oauthEnabled = isMcpOAuthEnabled();

  return {
    data: {
      host: mcpHost,
      url: mcpUrl,
      protocol,
      configured: !!configuredMcpHost,
      authRequired: !!process.env.MCP_API_KEY || oauthEnabled,
      oauthEnabled,
      oauthMetadataUrl: oauthEnabled
        ? `${protocol}://${host}${withBaseURL("/.well-known/oauth-authorization-server")}`
        : null,
      protectedResourceMetadataUrl: oauthEnabled
        ? `${protocol}://${host}${withBaseURL("/.well-known/oauth-protected-resource/api/mcp/connect")}`
        : null,
    },
  };
});
