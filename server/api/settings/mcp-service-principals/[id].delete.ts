import { defineEventHandler, createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { mcpServicePrincipals } from "~/server/database/schema";
import { requireSuperAdmin } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  const db = getDb();
  const existing = id
    ? await db
        .select()
        .from(mcpServicePrincipals)
        .where(eq(mcpServicePrincipals.id, id))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "MCP key not found.",
    });
  }
  if (existing.keyHash === null) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "The environment key entry cannot be deleted. Deactivate it instead.",
    });
  }

  await db.delete(mcpServicePrincipals).where(eq(mcpServicePrincipals.id, existing.id));
  return { success: true };
});
