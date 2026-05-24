import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { notificationSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const rows = await db.select({ id: notificationSettings.id }).from(notificationSettings).limit(1);
  const id = rows[0]?.id;

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Notification settings not found",
    });
  }

  const updateData: Partial<typeof notificationSettings.$inferInsert> = {};
  if (body.emailDigest !== undefined) updateData.emailDigest = !!body.emailDigest;
  if (body.releaseAlerts !== undefined) updateData.releaseAlerts = !!body.releaseAlerts;
  if (body.docComments !== undefined) updateData.docComments = !!body.docComments;
  if (body.slackNotifications !== undefined) updateData.slackNotifications = !!body.slackNotifications;
  updateData.updatedAt = new Date();

  const updated = await db
    .update(notificationSettings)
    .set(updateData)
    .where(eq(notificationSettings.id, id))
    .returning()
    .then((r) => r[0]);

  return { data: updated };
});
