import { defineEventHandler, readBody, createError } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { notionSyncSettings } from "~/server/database/schema";
import { requireTeamAccess } from "~/server/utils/team-access";
import { encryptSecret } from "~/server/utils/secret-crypto";
import { getNotionSyncRow } from "~/server/lib/notion/sync";

export default defineEventHandler(async (event) => {
  await requireTeamAccess(event, "admin");
  const body = await readBody(event);
  const row = await getNotionSyncRow();
  const db = getDb();

  const updateData: Partial<typeof notionSyncSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.apiKey !== undefined) {
    const key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (key && key !== "••••••••") {
      updateData.apiKeyEncrypted = encryptSecret(key);
      updateData.connected = false;
    }
  }

  if (body.docsDatabaseId !== undefined) {
    const next = String(body.docsDatabaseId || "").trim() || null;
    if (next !== (row.docsDatabaseId || null)) {
      updateData.docsDatabaseId = next;
      updateData.connected = false;
    }
  }
  if (body.releasesDatabaseId !== undefined) {
    const next = String(body.releasesDatabaseId || "").trim() || null;
    if (next !== (row.releasesDatabaseId || null)) {
      updateData.releasesDatabaseId = next;
      updateData.connected = false;
    }
  }
  if (body.appPropertyName !== undefined) {
    updateData.appPropertyName = String(body.appPropertyName || "App").trim() || "App";
  }
  if (body.versionPropertyName !== undefined) {
    updateData.versionPropertyName = String(body.versionPropertyName || "Version").trim() || "Version";
  }
  if (body.statusPropertyName !== undefined) {
    updateData.statusPropertyName = String(body.statusPropertyName || "Status").trim() || "Status";
  }
  if (body.scheduleEnabled !== undefined) {
    updateData.scheduleEnabled = !!body.scheduleEnabled;
  }
  if (body.scheduleInterval !== undefined) {
    const interval = body.scheduleInterval === "hourly" ? "hourly" : "daily";
    updateData.scheduleInterval = interval;
  }
  if (body.connected !== undefined) {
    updateData.connected = !!body.connected;
  }

  const updated = await db
    .update(notionSyncSettings)
    .set(updateData)
    .where(eq(notionSyncSettings.id, row.id))
    .returning()
    .then((rows) => rows[0]);

  if (!updated) {
    throw createError({ statusCode: 500, message: "Failed to save Notion settings" });
  }

  return {
    data: {
      id: updated.id,
      hasApiKey: !!updated.apiKeyEncrypted,
      docsDatabaseId: updated.docsDatabaseId || "",
      releasesDatabaseId: updated.releasesDatabaseId || "",
      appPropertyName: updated.appPropertyName,
      versionPropertyName: updated.versionPropertyName,
      statusPropertyName: updated.statusPropertyName,
      scheduleEnabled: updated.scheduleEnabled,
      scheduleInterval: updated.scheduleInterval,
      connected: updated.connected,
      lastSyncAt: updated.lastSyncAt?.toISOString() || null,
      lastSyncStatus: updated.lastSyncStatus,
      lastSyncResult: updated.lastSyncResult,
    },
  };
});
