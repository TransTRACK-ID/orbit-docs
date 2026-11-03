import { defineEventHandler, createError, getRouterParam } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { getCurrentMember } from "~/server/utils/team-access";
import { loadPendingRequest } from "~/server/utils/mcp-oauth/store";
import { describeScope } from "~/server/utils/mcp-oauth/consent";

/**
 * Returns a pending MCP authorization request for the consent screen.
 * Requires a signed-in session; unauthenticated browsers are sent to login.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const requestId = getRouterParam(event, "id");

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing authorization request id.",
    });
  }

  const pending = await loadPendingRequest(requestId);
  if (!pending) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "This authorization request is invalid or has expired. Start the connection again from your AI app.",
    });
  }

  const member = await getCurrentMember(event).catch(() => null);

  return {
    request_id: pending.requestId,
    client_id: pending.clientId,
    client_name: pending.clientName,
    redirect_host: (() => {
      try {
        return new URL(pending.redirectUri).host;
      } catch {
        return pending.redirectUri;
      }
    })(),
    scopes: pending.scope.split(/\s+/).filter(Boolean),
    scope_descriptions: describeScope(pending.scope),
    expires_at: pending.expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    },
    role: member ? (member.role as string) : null,
  };
});
