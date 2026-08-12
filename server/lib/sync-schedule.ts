import type { NotionSyncInterval } from "~/server/database/schema/notion-sync";
import { getNotionSyncRow } from "~/server/lib/notion/sync";

export const SYNC_INTERVAL_MS: Record<NotionSyncInterval, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export interface WorkspaceSyncSchedule {
  enabled: boolean;
  interval: NotionSyncInterval;
}

export async function getWorkspaceSyncSchedule(): Promise<WorkspaceSyncSchedule> {
  const row = await getNotionSyncRow();
  return {
    enabled: row.scheduleEnabled,
    interval: row.scheduleInterval === "hourly" ? "hourly" : "daily",
  };
}

export function isSyncIntervalDue(
  lastRunAt: Date | string | null | undefined,
  interval: NotionSyncInterval,
  now = Date.now()
): boolean {
  const intervalMs = SYNC_INTERVAL_MS[interval];
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= intervalMs;
}

export function formatSyncIntervalLabel(interval: NotionSyncInterval): string {
  return interval === "hourly" ? "every hour" : "once per day";
}
