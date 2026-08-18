import { defineEventHandler } from "h3";
import { ensurePublicDocsAccess, getPublicWorkspace } from "~/server/lib/public-docs-access";

export default defineEventHandler(async (event) => {
  await ensurePublicDocsAccess(event);
  const workspace = await getPublicWorkspace();
  return { data: workspace };
});
