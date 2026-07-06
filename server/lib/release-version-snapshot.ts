import type { getDb } from "~/server/database";
import { releaseVersions } from "~/server/database/schema";

type Db = ReturnType<typeof getDb>;

const VALID_RELEASE_VERSION_ACTIONS = ["save", "publish", "restore"] as const;
export type ReleaseVersionAction = (typeof VALID_RELEASE_VERSION_ACTIONS)[number];

export async function createReleaseVersionSnapshot(
  db: Db,
  releaseId: string,
  snapshot: {
    heroTitle: string | null;
    summary: string | null;
    published: boolean;
  },
  actor: string,
  action: ReleaseVersionAction,
) {
  return db
    .insert(releaseVersions)
    .values({
      releaseId,
      heroTitle: snapshot.heroTitle,
      summary: snapshot.summary,
      published: snapshot.published,
      actor,
      action,
    })
    .returning()
    .then((rows) => rows[0]);
}

export function isValidReleaseVersionAction(action: unknown): action is ReleaseVersionAction {
  return typeof action === "string" && VALID_RELEASE_VERSION_ACTIONS.includes(action as ReleaseVersionAction);
}
