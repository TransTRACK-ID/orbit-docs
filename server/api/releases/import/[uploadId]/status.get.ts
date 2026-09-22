import { defineEventHandler, getRouterParam } from "h3";
import { requirePermission } from "~/server/utils/rbac";
import {
  IMPORT_CHUNK_SIZE,
  listReceivedChunks,
  readImportSession,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");
  const uploadId = getRouterParam(event, "uploadId") || "";

  const { dir, meta } = await readImportSession(uploadId, user.id);
  const received = await listReceivedChunks(dir);

  return {
    data: {
      uploadId: meta.uploadId,
      fileName: meta.fileName,
      totalSize: meta.totalSize,
      totalChunks: meta.totalChunks,
      chunkSize: IMPORT_CHUNK_SIZE,
      status: meta.status,
      received,
    },
  };
});
