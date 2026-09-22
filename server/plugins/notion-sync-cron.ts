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

export default defineNitroPlugin(() => {
  const tick = async () => {
    try {
      // A "running" status can outlive its process (restart/crash mid-sync).
      // Clear stale runs before anything else so manual and scheduled syncs recover.
      await resetStaleNotionSyncRun();

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
    } catch (err: any) {
      console.warn("[sync-cron]", err?.message || err);
    }
  };

  // Check every 5 minutes whether a scheduled sync is due.
  const timer = setInterval(tick, 5 * 60 * 1000);
  timer.unref?.();

  // Initial delayed run so server startup is not blocked.
  setTimeout(tick, 30_000).unref?.();
});
