import { defineEventHandler } from "h3";
import {
  getAuthorizationEndpoint,
  getMcpOAuthIssuer,
  getTokenEndpoint,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";

export default defineEventHandler(() => {
  if (!isMcpOAuthEnabled()) {
    return {
      issuer: getMcpOAuthIssuer(),
      enabled: false,
    };
  }

  return {
    issuer: getMcpOAuthIssuer(),
    authorization_endpoint: getAuthorizationEndpoint(),
    token_endpoint: getTokenEndpoint(),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    scopes_supported: ["mcp:read"],
    client_id_metadata_document_supported: true,
  };
});
