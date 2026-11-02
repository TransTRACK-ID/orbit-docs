import { defineEventHandler, createError, getRouterParam } from "h3";
import { requireDocAssetAccess } from "~/server/lib/doc-assets";
import { loadPdfImportJobOr404, toPdfImportJobDto } from "~/server/lib/pdf-import-jobs";

/** Returns the converted markdown of a finished import. */
export default defineEventHandler(async (event) => {
  const { doc, context } = await requireDocAssetAccess(event, "write");
  const job = await loadPdfImportJobOr404(doc.id, context.user.id, getRouterParam(event, "jobId"));
  if (job.status !== "completed" || job.markdown === null) {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "This import has no result to insert" });
  }
  return { data: { ...toPdfImportJobDto(job), markdown: job.markdown } };
});
