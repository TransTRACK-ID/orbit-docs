import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { apiKeys } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

function generateKey(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + result;
}

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const rows = await db.select({ id: apiKeys.id }).from(apiKeys).limit(1);
  const id = rows[0]?.id;

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "API keys not found",
    });
  }

  const updateData: Partial<typeof apiKeys.$inferInsert> = {};
  updateData.updatedAt = new Date();

  if (body.productionKey === true) {
    updateData.productionKey = generateKey("od_live_");
  }
  if (body.webhookSecret === true) {
    updateData.webhookSecret = generateKey("whsec_");
  }
  if (body.revokeAll === true) {
    updateData.productionKey = "od_live_revoked";
    updateData.webhookSecret = "whsec_revoked";
  }

  const updated = await db
    .update(apiKeys)
    .set(updateData)
    .where(eq(apiKeys.id, id))
    .returning()
    .then((r) => r[0]);

  return { data: updated };
});
