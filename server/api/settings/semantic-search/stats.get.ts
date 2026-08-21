import { getQuery } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { getEmbeddingWorkspaceStats } from "~/server/lib/doc-embeddings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const query = getQuery(event);
  const appId = typeof query.appId === "string" ? query.appId : undefined;

  const stats = await getEmbeddingWorkspaceStats({ appId });
  return { data: stats };
});
