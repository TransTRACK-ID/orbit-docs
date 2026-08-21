import { scheduleDocEmbedding } from "~/server/lib/doc-embeddings";
import { isIndexableDocType } from "~/server/lib/doc-chunking";

export function onDocContentSaved(doc: {
  id: string;
  docType?: string | null;
  content?: string | null;
}): void {
  if (!doc.id || !isIndexableDocType(doc.docType)) return;
  scheduleDocEmbedding(doc.id);
}
