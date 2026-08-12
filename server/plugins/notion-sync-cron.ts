import { getNotionSyncRow, runNotionSync, loadNotionSyncConfig } from "~/server/lib/notion/sync";
import {
  getWorkspaceSyncSchedule,
  isSyncIntervalDue,
} from "~/server/lib/sync-schedule";
import { runScheduledDocGenerations } from "~/server/lib/doc-generation-schedule";

export default defineNitroPlugin(() => {
  const tick = async () => {
    try {
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
