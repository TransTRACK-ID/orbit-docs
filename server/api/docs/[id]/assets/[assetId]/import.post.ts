import { defineEventHandler, createError, getRouterParam } from "h3";
import { loadDocAssetOr404, requireDocAssetAccess } from "~/server/lib/doc-assets";
import { readDocAssetBuffer } from "~/server/lib/s3-storage";
import { extractPdfPages, looksLikeScannedPdf, pdfPagesToMarkdown } from "~/server/lib/pdf-import";

/** Returns markdown for the editor; the client decides whether to replace or append before saving. */
export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "write");
  const asset = await loadDocAssetOr404(doc.id, getRouterParam(event, "assetId"));

  if (asset.kind !== "pdf" || asset.status !== "ready") {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "Only uploaded PDFs can be imported" });
  }

  let pages: string[];
  try {
    pages = await extractPdfPages(await readDocAssetBuffer(asset.s3Key));
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    throw createError({
      statusCode: 422,
      statusMessage: "Unprocessable Entity",
      message: "We couldn't read this PDF. It may be password-protected or damaged; export it again and re-upload.",
    });
  }

  if (looksLikeScannedPdf(pages)) {
    throw createError({
      statusCode: 422,
      statusMessage: "Unprocessable Entity",
      message: "This PDF has no selectable text, so it looks scanned. Scanned PDFs need OCR, which isn't supported yet.",
    });
  }

  const { markdown, usedAi } = await pdfPagesToMarkdown(pages);
  return { data: { markdown, pages: pages.length, usedAi } };
});
