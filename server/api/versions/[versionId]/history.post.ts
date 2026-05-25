import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { versionHistory, appVersions } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const body = await readBody(event);

  const { versionId, content, action } = body || {};

  if (!versionId || typeof versionId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "versionId is required",
    });
  }

  if (typeof content !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "content is required",
    });
  }

  // Verify version exists
  const version = await db
    .select({ id: appVersions.id })
    .from(appVersions)
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  const actor = getActorName(user);

  const entry = await db
    .insert(versionHistory)
    .values({
      versionId,
      content,
      action: action === "publish" ? "publish" : "save",
      actor,
    })
    .returning()
    .then((rows) => rows[0]);

  return { data: entry };
});