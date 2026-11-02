import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
import { requireDocAssetAccess } from "~/server/lib/doc-assets";
import { loadPdfImportJobOr404, toPdfImportJobDto, updatePdfImportJob } from "~/server/lib/pdf-import-jobs";

/** `{ action: "cancel" }` stops a running import; `{ action: "resolve" }` clears a finished one after insert or dismiss. */
export default defineEventHandler(async (event) => {
  const { doc, context } = await requireDocAssetAccess(event, "write");
  const job = await loadPdfImportJobOr404(doc.id, context.user.id, getRouterParam(event, "jobId"));
  const body = await readBody<{ action?: string }>(event);
  if (body?.action !== "cancel" && body?.action !== "resolve") {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "action must be cancel or resolve" });
  }
  const updated = await updatePdfImportJob(job, body.action);
  return { data: toPdfImportJobDto(updated) };
});
