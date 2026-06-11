import { getDb } from "~/server/database";
import { docGenerationSettings } from "~/server/database/schema";

export interface DocGenerationConfig {
  srsEnabled: boolean;
  fsdEnabled: boolean;
  gitSnapshotEnabled: boolean;
  sddIndexEnabled: boolean;
  sddPerRepoEnabled: boolean;
}

const DEFAULTS: DocGenerationConfig = {
  srsEnabled: true,
  fsdEnabled: true,
  gitSnapshotEnabled: true,
  sddIndexEnabled: true,
  sddPerRepoEnabled: true,
};

export async function getDocGenerationSettings(): Promise<DocGenerationConfig> {
  const db = getDb();
  const row = await db.select().from(docGenerationSettings).limit(1).then((rows) => rows[0]);

  if (!row) {
    const inserted = await db
      .insert(docGenerationSettings)
      .values({ id: crypto.randomUUID(), ...DEFAULTS })
      .returning()
      .then((rows) => rows[0]);
    return {
      srsEnabled: inserted.srsEnabled,
      fsdEnabled: inserted.fsdEnabled,
      gitSnapshotEnabled: inserted.gitSnapshotEnabled,
      sddIndexEnabled: inserted.sddIndexEnabled,
      sddPerRepoEnabled: inserted.sddPerRepoEnabled,
    };
  }

  return {
    srsEnabled: row.srsEnabled,
    fsdEnabled: row.fsdEnabled,
    gitSnapshotEnabled: row.gitSnapshotEnabled,
    sddIndexEnabled: row.sddIndexEnabled,
    sddPerRepoEnabled: row.sddPerRepoEnabled,
  };
}
