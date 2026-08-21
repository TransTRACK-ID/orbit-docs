import { readBody } from "h3";
import { INDEXABLE_DOC_TYPES, type IndexableDocType } from "~/server/lib/doc-chunking";
import { rebuildDocEmbeddings } from "~/server/lib/doc-embeddings";
import { requireSuperAdmin } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  const body = (await readBody(event)) || {};
  const appId = typeof body.appId === "string" ? body.appId.trim() : undefined;
  const dryRun = Boolean(body.dryRun);

  let docTypes: IndexableDocType[] | undefined;
  if (Array.isArray(body.docTypes)) {
    docTypes = body.docTypes
      .map((value: unknown) => String(value).trim())
      .filter((value: string): value is IndexableDocType =>
        INDEXABLE_DOC_TYPES.includes(value as IndexableDocType),
      );
  }

  const result = await rebuildDocEmbeddings({
    appId: appId || undefined,
    docTypes,
    dryRun,
  });

  return { data: result };
});
