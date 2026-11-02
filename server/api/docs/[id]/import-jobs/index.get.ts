import { defineEventHandler } from "h3";
import { requireDocAssetAccess } from "~/server/lib/doc-assets";
import { listOpenPdfImportJobs, toPdfImportJobDto } from "~/server/lib/pdf-import-jobs";

export default defineEventHandler(async (event) => {
  const { doc, context } = await requireDocAssetAccess(event, "write");
  const jobs = await listOpenPdfImportJobs(doc.id, context.user.id);
  return { data: jobs.map(toPdfImportJobDto) };
});
