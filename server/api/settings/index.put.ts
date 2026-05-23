import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { workspaceSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const rows = await db.select({ id: workspaceSettings.id }).from(workspaceSettings).limit(1);
  const id = rows[0]?.id;

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Workspace settings not found",
    });
  }

  const updateData: Partial<typeof workspaceSettings.$inferInsert> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.slug !== undefined) updateData.slug = body.slug.trim();
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.theme !== undefined) updateData.theme = body.theme;
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null;
  if (body.publicDocsAccess !== undefined) updateData.publicDocsAccess = !!body.publicDocsAccess;
  updateData.updatedAt = new Date();

  const updated = await db
    .update(workspaceSettings)
    .set(updateData)
    .where(eq(workspaceSettings.id, id))
    .returning()
    .then((r) => r[0]);

  return { data: updated };
});
