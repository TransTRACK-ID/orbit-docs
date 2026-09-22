import {
  NOTION_SYNC_INTERVALS,
  type NotionSyncInterval,
} from "~/server/database/schema/notion-sync";
import { getNotionSyncRow } from "~/server/lib/notion/sync";

export const SYNC_INTERVAL_MS: Record<NotionSyncInterval, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export const SYNC_INTERVAL_LABELS: Record<NotionSyncInterval, string> = {
  hourly: "every hour",
  daily: "once per day",
  weekly: "once per week",
  monthly: "once per month",
};

export interface WorkspaceSyncSchedule {
  enabled: boolean;
  interval: NotionSyncInterval;
}

export async function getWorkspaceSyncSchedule(): Promise<WorkspaceSyncSchedule> {
  const row = await getNotionSyncRow();
  return {
    enabled: row.scheduleEnabled,
    interval: (NOTION_SYNC_INTERVALS as readonly string[]).includes(row.scheduleInterval)
      ? row.scheduleInterval
      : "daily",
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
  return SYNC_INTERVAL_LABELS[interval];
}
