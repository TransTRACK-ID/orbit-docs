import { defineEventHandler, getQuery } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { revokeUserGrants } from "~/server/utils/mcp-oauth/store";

/**
 * Revokes the signed-in user's MCP grants. Pass `?family_id=…` to revoke a
 * single connected app, or omit it to revoke all of them. Short-lived access
 * tokens expire on their own within the hour; refresh tokens stop working
 * immediately.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const query = getQuery(event);
  const familyId = typeof query.family_id === "string" ? query.family_id : undefined;
  const revoked = await revokeUserGrants(user.id, familyId);
  return { data: { revoked } };
});
