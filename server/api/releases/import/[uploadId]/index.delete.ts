import { defineEventHandler, getRouterParam } from "h3";
import { requirePermission } from "~/server/utils/rbac";
import {
  cleanupImportSession,
  readImportSession,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");
  const uploadId = getRouterParam(event, "uploadId") || "";

  await readImportSession(uploadId, user.id);
  await cleanupImportSession(uploadId);

  return { data: { deleted: true } };
});
