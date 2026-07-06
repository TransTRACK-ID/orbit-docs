import type { getDb } from "~/server/database";
import { docVersions } from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

const VALID_DOC_VERSION_ACTIONS = ["save", "publish", "restore"] as const;
export type DocVersionAction = (typeof VALID_DOC_VERSION_ACTIONS)[number];

export async function createDocVersionSnapshot(
  db: Db,
  docId: string,
  snapshot: { title: string | null; content: string | null },
  actor: string,
  action: DocVersionAction,
) {
  const existingVersions = await db
    .select()
    .from(docVersions)
    .where(eq(docVersions.docId, docId))
    .orderBy(desc(docVersions.createdAt));

  const nextVersionNum = existingVersions.length + 1;

  return db
    .insert(docVersions)
    .values({
      docId,
      version: `v${nextVersionNum}`,
      content: snapshot.content || "",
      title: snapshot.title,
      actor,
      action,
    })
    .returning()
    .then((rows) => rows[0]);
}

export function isValidDocVersionAction(action: unknown): action is DocVersionAction {
  return typeof action === "string" && VALID_DOC_VERSION_ACTIONS.includes(action as DocVersionAction);
}
