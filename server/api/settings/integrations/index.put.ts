import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { integrationSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const rows = await db.select({ id: integrationSettings.id }).from(integrationSettings).limit(1);
  const id = rows[0]?.id;

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Integration settings not found",
    });
  }

  const updateData: Partial<typeof integrationSettings.$inferInsert> = {};
  if (body.githubActions !== undefined) updateData.githubActions = !!body.githubActions;
  if (body.gitlabCI !== undefined) updateData.gitlabCI = !!body.gitlabCI;
  if (body.jenkins !== undefined) updateData.jenkins = !!body.jenkins;
  if (body.circleCI !== undefined) updateData.circleCI = !!body.circleCI;
  updateData.updatedAt = new Date();

  const updated = await db
    .update(integrationSettings)
    .set(updateData)
    .where(eq(integrationSettings.id, id))
    .returning()
    .then((r) => r[0]);

  return { data: updated };
});
