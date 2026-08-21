import { defineEventHandler, createError, getRouterParam } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { getDocEmbeddingStatus } from "~/server/lib/doc-embeddings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Doc ID is required",
    });
  }

  const status = await getDocEmbeddingStatus(id);
  return { data: status };
});
