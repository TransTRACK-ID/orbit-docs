import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { appVersions, apps, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const versionId = getRouterParam(event, "versionId");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  if (!versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Version ID is required",
    });
  }

  // Verify version exists and belongs to app
  const existing = await db
    .select({ id: appVersions.id, appId: appVersions.appId, version: appVersions.version })
    .from(appVersions)
    .where(eq(appVersions.id, versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version not found",
    });
  }

  if (existing.appId !== appId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Version does not belong to this app",
    });
  }

  const body = await readBody(event);
  const {
    version,
    status,
    releaseDate,
    releaseNotes,
    branch,
    tags,
    commitHash,
    approver,
    ciStatus,
  } = body || {};

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (version !== undefined) {
    if (typeof version !== "string" || version.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Version number is required",
      });
    }
    updates.version = version.trim();
  }

  if (status !== undefined) {
    updates.status = status;
  }

  if (releaseDate !== undefined) {
    updates.releaseDate = releaseDate ? new Date(releaseDate) : null;
  }

  if (releaseNotes !== undefined) {
    updates.releaseNotes = releaseNotes || null;
  }

  if (branch !== undefined) {
    updates.branch = branch || null;
  }

  if (tags !== undefined) {
    updates.tags = tags || null;
  }

  if (commitHash !== undefined) {
    updates.commitHash = commitHash || null;
  }

  if (approver !== undefined) {
    updates.approver = approver || null;
  }

  if (ciStatus !== undefined) {
    updates.ciStatus = ciStatus;
  }

  const updated = await db
    .update(appVersions)
    .set(updates)
    .where(eq(appVersions.id, versionId))
    .returning()
    .then((rows) => rows[0]);

  const actor = getActorName(user);

  await db.insert(activityLogs).values({
    appId,
    appName: existing.version,
    action: `Updated ${existing.version}`,
    actor,
  });

  return { data: updated };
});
