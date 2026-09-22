import {
  defineEventHandler,
  createError,
  getRouterParam,
  readBody,
} from "h3";
import { promises as fs } from "node:fs";
import { basename, join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import {
  activityLogs,
  apps,
  appVersions,
  releases,
} from "~/server/database/schema";
import { requirePermission } from "~/server/utils/rbac";
import { getActorName } from "~/server/utils/auth";
import { getS3Config } from "~/server/utils/runtime-env";
import {
  buildReleaseMediaProxyPath,
  uploadReleaseAsset,
} from "~/server/lib/s3-storage";
import {
  assetMimeForPath,
  cleanupImportSession,
  collectMarkdownAssetRefs,
  deriveHeroTitle,
  listLocalImageRefs,
  readImportSession,
  rewriteMarkdownAssets,
  unzipImportArchive,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");
  const uploadId = getRouterParam(event, "uploadId") || "";

  const { dir, meta } = await readImportSession(uploadId, user.id);

  const body = await readBody(event);
  const markdownPath = body?.markdownPath;
  const heroTitleOverride =
    typeof body?.heroTitle === "string" ? body.heroTitle.trim() : "";

  if (typeof markdownPath !== "string" || !markdownPath) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "markdownPath is required",
    });
  }

  const db = getDb();

  const existing = await db
    .select({ id: releases.id, type: releases.type })
    .from(releases)
    .where(eq(releases.versionId, meta.versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing && existing.type === "article") {
    await cleanupImportSession(uploadId);
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "An article release already exists for this version",
      data: { existingReleaseId: existing.id, existingType: existing.type },
    });
  }

  let entries: Map<string, Uint8Array>;
  try {
    entries = unzipImportArchive(await fs.readFile(join(dir, "archive.zip")));
  } catch (error) {
    await cleanupImportSession(uploadId);
    throw error;
  }

  const mdData = entries.get(markdownPath);
  if (!mdData) {
    await cleanupImportSession(uploadId);
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Selected markdown file is not in the archive",
    });
  }

  const mdText = Buffer.from(mdData).toString("utf-8");
  const heroTitle =
    heroTitleOverride || meta.heroTitle || deriveHeroTitle(markdownPath, mdText);
  const refs = collectMarkdownAssetRefs(entries, markdownPath, mdText);

  const app = await db
    .select({ id: apps.id, name: apps.name })
    .from(apps)
    .where(eq(apps.id, meta.appId))
    .limit(1)
    .then((rows) => rows[0]);

  const version = await db
    .select({ id: appVersions.id, version: appVersions.version })
    .from(appVersions)
    .where(eq(appVersions.id, meta.versionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app || !version) {
    await cleanupImportSession(uploadId);
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "App or version no longer exists",
    });
  }

  const release = await db
    .insert(releases)
    .values({
      appId: meta.appId,
      versionId: meta.versionId,
      heroTitle,
      summary: mdText,
      type: "article",
      published: false,
    })
    .returning()
    .then((rows) => rows[0]);

  const warnings: string[] = [];
  const replacements = new Map<string, string>();
  const maxAssetBytes = getS3Config()?.uploadMaxBytes ?? 10 * 1024 * 1024;

  try {
    for (const [rawRef, entryPath] of refs) {
      const data = entries.get(entryPath)!;
      const mime = assetMimeForPath(entryPath);
      const label = basename(entryPath);

      if (!mime) {
        warnings.push(`${label} skipped: unsupported file type`);
        continue;
      }
      if (data.byteLength > maxAssetBytes) {
        warnings.push(
          `${label} skipped: larger than ${Math.round(maxAssetBytes / 1024 / 1024)} MB`
        );
        continue;
      }

      try {
        const { assetId } = await uploadReleaseAsset(
          release.id,
          Buffer.from(data),
          mime
        );
        replacements.set(rawRef, buildReleaseMediaProxyPath(release.id, assetId));
      } catch {
        warnings.push(`${label} could not be uploaded`);
      }
    }

    const summary = rewriteMarkdownAssets(mdText, replacements);
    await db.update(releases).set({ summary }).where(eq(releases.id, release.id));
    release.summary = summary;
  } catch (error) {
    await db.delete(releases).where(eq(releases.id, release.id));
    await cleanupImportSession(uploadId);
    throw error;
  }

  await db.insert(activityLogs).values({
    appId: meta.appId,
    appName: app.name,
    action: `Release imported from Notion for ${version.version}`,
    actor: getActorName(user),
  });

  await cleanupImportSession(uploadId);

  const missingCount = listLocalImageRefs(mdText).filter(
    (ref) => !refs.has(ref)
  ).length;
  if (missingCount > 0) {
    warnings.push(
      `${missingCount} image reference(s) had no matching file in the archive`
    );
  }

  return { data: release, warnings };
});
