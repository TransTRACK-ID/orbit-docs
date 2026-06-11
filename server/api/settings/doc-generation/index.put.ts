import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { docGenerationSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  let row = await db.select().from(docGenerationSettings).limit(1).then((rows) => rows[0]);

  if (!row) {
    const inserted = await db
      .insert(docGenerationSettings)
      .values({
        id: crypto.randomUUID(),
        srsEnabled: body.srsEnabled ?? true,
        fsdEnabled: body.fsdEnabled ?? true,
        gitSnapshotEnabled: body.gitSnapshotEnabled ?? true,
        sddIndexEnabled: body.sddIndexEnabled ?? true,
        sddPerRepoEnabled: body.sddPerRepoEnabled ?? true,
      })
      .returning()
      .then((rows) => rows[0]);
    return { data: inserted };
  }

  const patch: Partial<typeof row> = { updatedAt: new Date() };
  if (typeof body.srsEnabled === "boolean") patch.srsEnabled = body.srsEnabled;
  if (typeof body.fsdEnabled === "boolean") patch.fsdEnabled = body.fsdEnabled;
  if (typeof body.gitSnapshotEnabled === "boolean") patch.gitSnapshotEnabled = body.gitSnapshotEnabled;
  if (typeof body.sddIndexEnabled === "boolean") patch.sddIndexEnabled = body.sddIndexEnabled;
  if (typeof body.sddPerRepoEnabled === "boolean") patch.sddPerRepoEnabled = body.sddPerRepoEnabled;

  const updated = await db
    .update(docGenerationSettings)
    .set(patch)
    .where(eq(docGenerationSettings.id, row.id))
    .returning()
    .then((rows) => rows[0]);

  if (!updated) {
    throw createError({ statusCode: 500, message: "Failed to update doc generation settings" });
  }

  return { data: updated };
});
