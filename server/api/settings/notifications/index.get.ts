import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { notificationSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  let rows = await db.select().from(notificationSettings).limit(1);
  let row = rows[0];

  if (!row) {
    const inserted = await db.insert(notificationSettings).values({
      id: crypto.randomUUID(),
      emailDigest: true,
      releaseAlerts: true,
      docComments: false,
      slackNotifications: false,
    }).returning();
    row = inserted[0];
  }

  return { data: row };
});
