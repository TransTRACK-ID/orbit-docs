import {
  getNotionSyncRow,
  runNotionSync,
  loadNotionSyncConfig,
  resetStaleNotionSyncRun,
} from "~/server/lib/notion/sync";
import {
  getWorkspaceSyncSchedule,
  isSyncIntervalDue,
} from "~/server/lib/sync-schedule";
import { runScheduledDocGenerations } from "~/server/lib/doc-generation-schedule";
import { runScheduledEmbeddingIndexes } from "~/server/lib/doc-embedding-schedule";
import { failStaleDocGenerationJobs } from "~/server/lib/stale-generation-jobs";
import { errorCauseMessage } from "~/server/utils/error-cause";

export default defineNitroPlugin(() => {
  // Reentrancy guard: a tick awaits full Notion syncs, scheduled doc
  // generations, and embedding reindexes — all routinely longer than the
  // 5-minute interval. Without this, ticks stack up concurrently, each
  // spawning its own agent subprocesses and DB work until the process is
  // memory/CPU saturated.
  let tickInFlight = false;
  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      // A "running" status can outlive its process (restart/crash mid-sync).
      // Clear stale runs before anything else so manual and scheduled syncs recover.
      await resetStaleNotionSyncRun();
      // Same for generation jobs: they run in-process, so a restart mid-run
      // leaves a non-terminal job that would 409 every later run for the app.
      await failStaleDocGenerationJobs();

      const workspaceSchedule = await getWorkspaceSyncSchedule();
      if (!workspaceSchedule.enabled) return;

      const notionRow = await getNotionSyncRow();
      if (
        notionRow.connected &&
        notionRow.lastSyncStatus !== "running" &&
        isSyncIntervalDue(notionRow.lastSyncAt, workspaceSchedule.interval)
      ) {
        const config = await loadNotionSyncConfig();
        if (config) {
          await runNotionSync();
        }
      }

      await runScheduledDocGenerations();
      await runScheduledEmbeddingIndexes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const cause = errorCauseMessage(err);
      if (cause) {
        console.warn("[sync-cron]", message, "| cause:", cause);
      } else {
        console.warn("[sync-cron]", message);
      }
    } finally {
      tickInFlight = false;
    }
  };

  // Check every 5 minutes whether a scheduled sync is due.
  const timer = setInterval(tick, 5 * 60 * 1000);
  timer.unref?.();

  // Initial delayed run so server startup is not blocked.
  setTimeout(tick, 30_000).unref?.();
});
