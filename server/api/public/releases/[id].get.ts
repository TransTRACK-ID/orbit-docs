import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { releases, apps, appVersions } from "~/server/database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const id = getRouterParam(event, "id");

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
    .innerJoin(appVersions, eq(releases.versionId, appVersions.id))
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
