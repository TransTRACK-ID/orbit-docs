import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { docs, docVersions, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { createDocVersionSnapshot } from "~/server/lib/doc-version-snapshot";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  const versionId = getRouterParam(event, "version");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  if (!versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version ID is required",
    });
  }

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Doc not found",
    });
  }

  const versionRow = await db
    .select()
    .from(docVersions)
    .where(eq(docVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!versionRow || versionRow.docId !== id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  // Save current content as a restore snapshot before overwriting.
  await createDocVersionSnapshot(
    db,
    id,
    { title: existing.title, content: existing.content },
    getActorName(user),
    "restore",
  );

  // Restore the selected version
  const updatedRow = await db
    .update(docs)
    .set({
      content: versionRow.content || "",
      title: versionRow.title || existing.title,
      updatedAt: new Date(),
    })
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: existing.title,
    action: `Restored version ${versionRow.version}`,
    actor: getActorName(user),
  });

  return { data: updatedRow };
});
