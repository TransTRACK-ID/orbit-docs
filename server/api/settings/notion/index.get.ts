import { defineEventHandler } from "h3";
import { requireTeamAccess } from "~/server/utils/team-access";
import { getNotionSyncRow } from "~/server/lib/notion/sync";

import type { notionSyncSettings } from "~/server/database/schema";

function toPublicSettings(row: typeof notionSyncSettings.$inferSelect) {
  return {
    id: row.id,
    hasApiKey: !!row.apiKeyEncrypted,
    docsDatabaseId: row.docsDatabaseId || "",
    releasesDatabaseId: row.releasesDatabaseId || "",
    appPropertyName: row.appPropertyName,
    versionPropertyName: row.versionPropertyName,
    statusPropertyName: row.statusPropertyName,
    scheduleEnabled: row.scheduleEnabled,
    scheduleInterval: row.scheduleInterval,
    connected: row.connected,
    lastSyncAt: row.lastSyncAt?.toISOString() || null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncResult: row.lastSyncResult,
    createdAt: row.createdAt?.toISOString() || null,
    updatedAt: row.updatedAt?.toISOString() || null,
  };
}

export default defineEventHandler(async (event) => {
  await requireTeamAccess(event, "admin");
  const row = await getNotionSyncRow();
  return { data: toPublicSettings(row) };
});
