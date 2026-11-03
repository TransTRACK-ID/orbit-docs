import { defineEventHandler } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { listUserGrants } from "~/server/utils/mcp-oauth/store";

/** Lists the signed-in user's active MCP client grants. */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const grants = await listUserGrants(user.id);
  return {
    data: grants.map((grant) => ({
      family_id: grant.familyId,
      client_id: grant.clientId,
      client_name: grant.clientName,
      scope: grant.scope,
      created_at: grant.createdAt,
    })),
  };
});
