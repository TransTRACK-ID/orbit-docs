import { defineEventHandler, createError, getRouterParam, setResponseStatus } from "h3";
import { loadDocAssetOr404, requireDocAssetAccess } from "~/server/lib/doc-assets";
import { startPdfImportJob, toPdfImportJobDto } from "~/server/lib/pdf-import-jobs";

/** Starts a background PDF-to-markdown job; poll `/api/docs/:id/import-jobs` for progress and the result. */
export default defineEventHandler(async (event) => {
  const { doc, context } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));

  if (asset.kind !== "pdf" || asset.status !== "ready") {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "Only uploaded PDFs can be imported" });
  }

  const job = await startPdfImportJob(asset, context.user.id);
  setResponseStatus(event, 202);
  return { data: toPdfImportJobDto(job) };
});
