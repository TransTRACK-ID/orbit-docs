import { defineEventHandler } from "h3";
import { getDb } from "~/server/database";
import { docGenerationSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  let row = await db.select().from(docGenerationSettings).limit(1).then((rows) => rows[0]);

  if (!row) {
    row = await db
      .insert(docGenerationSettings)
      .values({
        id: crypto.randomUUID(),
        srsEnabled: true,
        fsdEnabled: true,
        gitSnapshotEnabled: true,
        sddIndexEnabled: true,
        sddPerRepoEnabled: true,
      })
      .returning()
      .then((rows) => rows[0]);
  }

  return { data: row };
});
