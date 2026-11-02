import { createError } from "h3";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { getDb } from "~/server/database";
import { pdfImportJobs } from "~/server/database/schema";
import type { DocAssetRow } from "~/server/lib/doc-assets";
import { readDocAssetBuffer } from "~/server/lib/s3-storage";
import { extractPdfPages, looksLikeScannedPdf, pdfPagesToMarkdown } from "~/server/lib/pdf-import";

export type PdfImportJobRow = typeof pdfImportJobs.$inferSelect;
export type PdfImportJobStatus = PdfImportJobRow["status"];

export const ACTIVE_PDF_IMPORT_STATUSES: PdfImportJobStatus[] = ["extracting", "converting"];
/** A running job writes progress at least once per AI batch (240s timeout), so silence past this means it died. */
const STALE_AFTER_MS = 10 * 60_000;
const CANCEL_POLL_MS = 3_000;

export interface PdfImportJobDto {
  id: string;
  docId: string;
  assetId: string;
  status: PdfImportJobStatus;
  progressPct: number;
  progressMessage: string | null;
  pageCount: number | null;
  usedAi: boolean;
  errorMessage: string | null;
  createdAt: Date | null;
  completedAt: Date | null;
}

export function toPdfImportJobDto(row: PdfImportJobRow): PdfImportJobDto {
  return {
    id: row.id,
    docId: row.docId,
    assetId: row.assetId,
    status: row.status,
    progressPct: row.progressPct,
    progressMessage: row.progressMessage,
    pageCount: row.pageCount,
    usedAi: row.usedAi,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

async function updateJob(jobId: string, values: Partial<typeof pdfImportJobs.$inferInsert>): Promise<void> {
  await getDb()
    .update(pdfImportJobs)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(pdfImportJobs.id, jobId), inArray(pdfImportJobs.status, ACTIVE_PDF_IMPORT_STATUSES)));
}

async function isCancelled(jobId: string): Promise<boolean> {
  const row = await getDb()
    .select({ status: pdfImportJobs.status })
    .from(pdfImportJobs)
    .where(eq(pdfImportJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);
  return !row || row.status === "cancelled";
}

async function runPdfImportJob(jobId: string, s3Key: string): Promise<void> {
  const controller = new AbortController();
  const cancelTimer = setInterval(() => {
    isCancelled(jobId)
      .then((cancelled) => cancelled && controller.abort())
      .catch(() => {});
  }, CANCEL_POLL_MS);

  try {
    let pages: string[];
    try {
      pages = await extractPdfPages(await readDocAssetBuffer(s3Key));
    } catch {
      throw new Error("We couldn't read this PDF. It may be password-protected or damaged; export it again and re-upload.");
    }
    if (looksLikeScannedPdf(pages)) {
      throw new Error("This PDF has no selectable text, so it looks scanned. Scanned PDFs need OCR, which isn't supported yet.");
    }

    await updateJob(jobId, {
      status: "converting",
      progressPct: 10,
      progressMessage: `Formatting ${pages.length} pages`,
      pageCount: pages.length,
    });

    const { markdown, usedAi } = await pdfPagesToMarkdown(pages, {
      signal: controller.signal,
      onBatchDone: (done, total) =>
        updateJob(jobId, {
          progressPct: 10 + Math.round((done / total) * 85),
          progressMessage: `Formatted part ${done} of ${total}`,
        }),
    });

    await updateJob(jobId, {
      status: "completed",
      progressPct: 100,
      progressMessage: "Ready to insert",
      markdown,
      usedAi,
      completedAt: new Date(),
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error(`[pdf-import] Job ${jobId} failed:`, err);
    await updateJob(jobId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "PDF import failed",
      completedAt: new Date(),
    });
  } finally {
    clearInterval(cancelTimer);
  }
}

/** Starts (or returns the already running) import for a PDF; the work continues after the request ends. */
export async function startPdfImportJob(asset: DocAssetRow, userId: string): Promise<PdfImportJobRow> {
  const db = getDb();
  const running = await db
    .select()
    .from(pdfImportJobs)
    .where(
      and(
        eq(pdfImportJobs.assetId, asset.id),
        eq(pdfImportJobs.userId, userId),
        inArray(pdfImportJobs.status, ACTIVE_PDF_IMPORT_STATUSES),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (running) return running;

  const job = await db
    .insert(pdfImportJobs)
    .values({
      docId: asset.docId,
      assetId: asset.id,
      userId,
      status: "extracting",
      progressPct: 2,
      progressMessage: "Reading PDF",
    })
    .returning()
    .then((rows) => rows[0]!);

  runPdfImportJob(job.id, asset.s3Key).catch((err) => {
    console.error(`[pdf-import] Job ${job.id} crashed:`, err);
  });
  return job;
}

export async function loadPdfImportJobOr404(
  docId: string,
  userId: string,
  jobId: string | undefined,
): Promise<PdfImportJobRow> {
  const row = jobId
    ? await getDb()
        .select()
        .from(pdfImportJobs)
        .where(and(eq(pdfImportJobs.id, jobId), eq(pdfImportJobs.docId, docId), eq(pdfImportJobs.userId, userId)))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Import not found" });
  }
  return row;
}

/** Cancels a running job or marks a finished one as handled (inserted or dismissed). */
export async function updatePdfImportJob(row: PdfImportJobRow, action: "cancel" | "resolve"): Promise<PdfImportJobRow> {
  const isActive = ACTIVE_PDF_IMPORT_STATUSES.includes(row.status);
  if (action === "cancel" && !isActive) {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "This import has already finished" });
  }
  if (action === "resolve" && isActive) {
    throw createError({ statusCode: 409, statusMessage: "Conflict", message: "This import is still running" });
  }
  const now = new Date();
  return getDb()
    .update(pdfImportJobs)
    .set(
      action === "cancel"
        ? { status: "cancelled", resolvedAt: now, completedAt: now, updatedAt: now }
        : { resolvedAt: now, markdown: null, updatedAt: now },
    )
    .where(eq(pdfImportJobs.id, row.id))
    .returning()
    .then((rows) => rows[0]!);
}

/** Jobs the user hasn't inserted or dismissed yet; jobs orphaned by a server restart are failed first. */
export async function listOpenPdfImportJobs(docId: string, userId: string): Promise<PdfImportJobRow[]> {
  const db = getDb();
  await db
    .update(pdfImportJobs)
    .set({
      status: "failed",
      errorMessage: "The import stopped unexpectedly (the server may have restarted). Try again.",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pdfImportJobs.docId, docId),
        inArray(pdfImportJobs.status, ACTIVE_PDF_IMPORT_STATUSES),
        lt(pdfImportJobs.updatedAt, new Date(Date.now() - STALE_AFTER_MS)),
      ),
    );

  return db
    .select()
    .from(pdfImportJobs)
    .where(
      and(
        eq(pdfImportJobs.docId, docId),
        eq(pdfImportJobs.userId, userId),
        isNull(pdfImportJobs.resolvedAt),
        inArray(pdfImportJobs.status, [...ACTIVE_PDF_IMPORT_STATUSES, "completed", "failed"]),
      ),
    )
    .orderBy(desc(pdfImportJobs.createdAt))
    .limit(10);
}
