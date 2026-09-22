import {
  defineEventHandler,
  createError,
  getRouterParam,
} from "h3";
import { promises as fs } from "node:fs";
import { requirePermission } from "~/server/utils/rbac";
import {
  cleanupImportSession,
  deriveHeroTitle,
  listMarkdownEntries,
  readImportSession,
  saveImportSessionMeta,
  stitchImportArchive,
  unzipImportArchive,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");
  const uploadId = getRouterParam(event, "uploadId") || "";

  const { dir, meta } = await readImportSession(uploadId, user.id);

  try {
    const archivePath = await stitchImportArchive(dir, meta);
    const entries = unzipImportArchive(await fs.readFile(archivePath));
    const markdownFiles = listMarkdownEntries(entries);

    if (markdownFiles.length === 0) {
      throw createError({
        statusCode: 422,
        statusMessage: "Unprocessable Content",
        message: "No markdown file found in the archive. Export a Notion page as Markdown & CSV.",
      });
    }

    meta.status = "ready";
    await saveImportSessionMeta(dir, meta);

    const first = markdownFiles[0]!;
    const firstText = Buffer.from(entries.get(first.path)!).toString("utf-8");

    return {
      data: {
        markdownFiles,
        suggestedTitle:
          meta.heroTitle || deriveHeroTitle(first.path, firstText),
      },
    };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode !== 409) {
      await cleanupImportSession(uploadId);
    }
    throw error;
  }
});
