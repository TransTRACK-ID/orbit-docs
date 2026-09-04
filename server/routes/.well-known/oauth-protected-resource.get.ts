import { defineEventHandler } from "h3";
import {
  getMcpOAuthIssuer,
  getMcpResourceUrl,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";

export default defineEventHandler(() => {
  if (!isMcpOAuthEnabled()) {
    return {
      resource: getMcpResourceUrl(),
      enabled: false,
    };
  }

  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [getMcpOAuthIssuer()],
    scopes_supported: ["mcp:read"],
    bearer_methods_supported: ["header"],
  };
});
