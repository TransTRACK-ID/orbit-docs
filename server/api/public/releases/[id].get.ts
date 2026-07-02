import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { releases, apps, appVersions, workspaceSettings } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const id = getRouterParam(event, "id");

  // Check workspace public docs access setting
  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const settings = settingsRows[0];
  const isPublic = settings?.publicDocsAccess ?? true;

  if (!isPublic) {
    await requireAuth(event);
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Release ID is required",
    });
  }

  const rows = await db
    .select({
      id: releases.id,
      appId: releases.appId,
      versionId: releases.versionId,
      heroTitle: releases.heroTitle,
      summary: releases.summary,
      features: releases.features,
      categories: releases.categories,
      type: releases.type,
      published: releases.published,
      createdAt: releases.createdAt,
      updatedAt: releases.updatedAt,
      appName: apps.name,
      version: appVersions.version,
      releaseDate: appVersions.releaseDate,
      createdBy: appVersions.createdBy,
      versionStatus: appVersions.status,
    })
    .from(releases)
    .innerJoin(apps, eq(releases.appId, apps.id))
    .leftJoin(appVersions, eq(releases.versionId, appVersions.id))
    .where(eq(releases.id, id))
    .limit(1);

  const release = rows[0];

  if (!release || !release.published) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Release not found",
    });
  }

  return { data: release };
});
