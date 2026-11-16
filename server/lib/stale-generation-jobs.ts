import { and, eq, lt, notInArray } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";

export const TERMINAL_JOB_STATUSES = ["completed", "failed", "cancelled"] as const;

/**
 * Generation runs in-process (fire-and-forget), so a restart or crash mid-run
 * leaves its job row non-terminal forever, and the one-active-run-per-app
 * guard then rejects every later manual and scheduled run with 409. The
 * slowest completed run on record took ~2h (repo scope; product ~70 min), so a
 * job older than this can no longer be running.
 */
export const STALE_GENERATION_JOB_AFTER_MS = 6 * 60 * 60 * 1000;

const STALE_JOB_MESSAGE =
  "Interrupted: no completion was recorded (server restarted or crashed mid-run)";

/**
 * Marks orphaned generation jobs as failed, optionally limited to one app.
 * Returns the ids it failed.
 */
export async function failStaleDocGenerationJobs(
  options: { appId?: string } = {},
): Promise<string[]> {
  const cutoff = new Date(Date.now() - STALE_GENERATION_JOB_AFTER_MS);
  const conditions = [
    notInArray(docGenerationJobs.status, [...TERMINAL_JOB_STATUSES]),
    lt(docGenerationJobs.createdAt, cutoff),
  ];
  if (options.appId) {
    conditions.push(eq(docGenerationJobs.appId, options.appId));
  }

  const failed = await getDb()
    .update(docGenerationJobs)
    .set({
      status: "failed",
      progressPct: 0,
      progressMessage: STALE_JOB_MESSAGE,
      errorMessage: STALE_JOB_MESSAGE,
      currentActivity: null,
      partialContent: null,
    })
    .where(and(...conditions))
    .returning({ id: docGenerationJobs.id });

  if (failed.length > 0) {
    console.warn(
      `[doc-generation] marked ${failed.length} stale job(s) failed (unfinished after ${
        STALE_GENERATION_JOB_AFTER_MS / 3_600_000
      }h): ${failed.map((row) => row.id).join(", ")}`,
    );
  }
  return failed.map((row) => row.id);
}
