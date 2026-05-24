import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { apiKeys } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  let rows = await db.select().from(apiKeys).limit(1);
  let row = rows[0];

  if (!row) {
    const inserted = await db.insert(apiKeys).values({
      id: crypto.randomUUID(),
      productionKey: "od_live_••••••••••••••••••••••••",
      webhookSecret: "whsec_••••••••••••••••••••••••••",
    }).returning();
    row = inserted[0];
  }

  return { data: row };
});
