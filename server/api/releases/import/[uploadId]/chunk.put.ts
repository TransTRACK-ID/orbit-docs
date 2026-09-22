import {
  defineEventHandler,
  createError,
  getQuery,
  getRouterParam,
  readRawBody,
} from "h3";
import { requirePermission } from "~/server/utils/rbac";
import {
  readImportSession,
  storeImportChunk,
} from "~/server/lib/notion-import";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "releases:write");
  const uploadId = getRouterParam(event, "uploadId") || "";

  const { dir, meta } = await readImportSession(uploadId, user.id);

  const index = Number.parseInt(String(getQuery(event).index ?? ""), 10);
  const raw = await readRawBody(event, false);
  const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw || "");

  if (!data.byteLength) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing chunk body",
    });
  }

  await storeImportChunk(dir, meta, index, data);

  return { data: { index, received: true } };
});
