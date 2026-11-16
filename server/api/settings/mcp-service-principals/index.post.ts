import { defineEventHandler, readBody, createError, setResponseStatus } from "h3";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "~/server/database";
import { mcpServicePrincipals } from "~/server/database/schema";
import { requireSuperAdmin } from "~/server/utils/rbac";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const body = await readBody(event);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role;

  if (!name || name.length > 60) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Key name is required (max 60 characters).",
    });
  }
  const allRoles = await loadRoles();
  if (!role || !allRoles.some((r) => r.slug === role)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Unknown role: ${role}`,
    });
  }

  const apiKey = "od_mcp_" + randomBytes(32).toString("hex");
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const id = crypto.randomUUID();
  const now = new Date();

  const db = getDb();
  await db.insert(mcpServicePrincipals).values({
    id,
    name,
    keyHash,
    role,
    isActive: true,
  });

  setResponseStatus(event, 201);
  return {
    data: {
      id,
      name,
      role,
      isActive: true,
      isEnvKey: false,
      createdAt: now,
      lastUsedAt: null,
      apiKey,
    },
  };
});
