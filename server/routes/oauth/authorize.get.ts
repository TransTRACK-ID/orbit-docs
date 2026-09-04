import { defineEventHandler, getQuery, setHeader, createError } from "h3";
import {
  getMcpOAuthClientId,
  isMcpOAuthEnabled,
} from "~/server/utils/mcp-oauth/config";
import { createAuthorizationCode } from "~/server/utils/mcp-oauth/codes";
import { isRedirectUriAllowed } from "~/server/utils/mcp-oauth/clients";
import { renderConsentPage } from "~/server/utils/mcp-oauth/consent";

function buildRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export default defineEventHandler(async (event) => {
  if (!isMcpOAuthEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "MCP OAuth is not configured on the server.",
    });
  }

  const query = getQuery(event);
  const clientId = typeof query.client_id === "string" ? query.client_id : undefined;
  const redirectUri =
    typeof query.redirect_uri === "string" ? query.redirect_uri : undefined;
  const responseType =
    typeof query.response_type === "string" ? query.response_type : undefined;
  const state = typeof query.state === "string" ? query.state : undefined;
  const scope = typeof query.scope === "string" ? query.scope : "mcp:read";
  const codeChallenge =
    typeof query.code_challenge === "string" ? query.code_challenge : undefined;
  const codeChallengeMethod =
    typeof query.code_challenge_method === "string"
      ? query.code_challenge_method
      : undefined;
  const approved = query.approved === "1";

  if (!clientId || !redirectUri || responseType !== "code") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "client_id, redirect_uri, and response_type=code are required.",
    });
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "PKCE with code_challenge_method=S256 is required.",
    });
  }

  if (!(await isRedirectUriAllowed(clientId, redirectUri))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "redirect_uri is not allowed.",
    });
  }

  if (!approved) {
    setHeader(event, "Content-Type", "text/html; charset=utf-8");
    return renderConsentPage({
      clientId,
      scope,
      state,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      responseType,
    });
  }

  const code = createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    scope,
  });

  return sendRedirect(
    event,
    buildRedirectUrl(redirectUri, {
      code,
      ...(state ? { state } : {}),
    }),
  );
});
