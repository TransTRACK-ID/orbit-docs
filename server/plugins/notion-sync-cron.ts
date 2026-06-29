import { getNotionSyncRow, runNotionSync, loadNotionSyncConfig } from "~/server/lib/notion/sync";

const HOURLY_MS = 60 * 60 * 1000;
const DAILY_MS = 24 * 60 * 60 * 1000;

export default defineNitroPlugin(() => {
  const tick = async () => {
    try {
      const row = await getNotionSyncRow();
      if (!row.scheduleEnabled || !row.connected) return;

      const config = await loadNotionSyncConfig();
      if (!config) return;

      const intervalMs = row.scheduleInterval === "hourly" ? HOURLY_MS : DAILY_MS;
      const last = row.lastSyncAt ? new Date(row.lastSyncAt).getTime() : 0;
      if (Date.now() - last < intervalMs) return;
      if (row.lastSyncStatus === "running") return;

      await runNotionSync();
    } catch (err: any) {
      console.warn("[notion-sync-cron]", err?.message || err);
    }
  };

  // Check every 5 minutes whether a scheduled sync is due.
  const timer = setInterval(tick, 5 * 60 * 1000);
  timer.unref?.();

  // Initial delayed run so server startup is not blocked.
  setTimeout(tick, 30_000).unref?.();
});
