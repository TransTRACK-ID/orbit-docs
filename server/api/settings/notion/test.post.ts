import { defineEventHandler, readBody, createError } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { notionSyncSettings } from "~/server/database/schema";
import { requireTeamAccess } from "~/server/utils/team-access";
import { encryptSecret, decryptSecret } from "~/server/utils/secret-crypto";
import {
  getNotionSyncRow,
  testNotionConnection,
  type NotionSyncConfig,
} from "~/server/lib/notion/sync";
import { NotionApiError } from "~/server/lib/notion/client";

export default defineEventHandler(async (event) => {
  await requireTeamAccess(event, "admin");
  const body = await readBody(event);
  const row = await getNotionSyncRow();
  const db = getDb();

  let apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey || apiKey === "••••••••") {
    if (!row.apiKeyEncrypted) {
      throw createError({ statusCode: 400, message: "Notion API key is required" });
    }
    apiKey = decryptSecret(row.apiKeyEncrypted);
  }

  const docsDatabaseId =
    String(body.docsDatabaseId ?? row.docsDatabaseId ?? "").trim() || null;
  const releasesDatabaseId =
    String(body.releasesDatabaseId ?? row.releasesDatabaseId ?? "").trim() || null;

  if (!docsDatabaseId && !releasesDatabaseId) {
    throw createError({
      statusCode: 400,
      message: "At least one database ID is required",
    });
  }

  const config: NotionSyncConfig = {
    apiKey,
    docsDatabaseId,
    releasesDatabaseId,
    appPropertyName: String(body.appPropertyName ?? row.appPropertyName ?? "App").trim() || "App",
    versionPropertyName:
      String(body.versionPropertyName ?? row.versionPropertyName ?? "Version").trim() || "Version",
    statusPropertyName:
      String(body.statusPropertyName ?? row.statusPropertyName ?? "Status").trim() || "Status",
  };

  try {
    const result = await testNotionConnection(config);

    const updateData: Partial<typeof notionSyncSettings.$inferInsert> = {
      connected: true,
      updatedAt: new Date(),
    };

    if (body.apiKey && body.apiKey !== "••••••••") {
      updateData.apiKeyEncrypted = encryptSecret(apiKey);
    }
    if (body.docsDatabaseId !== undefined) updateData.docsDatabaseId = docsDatabaseId;
    if (body.releasesDatabaseId !== undefined) updateData.releasesDatabaseId = releasesDatabaseId;
    if (body.appPropertyName !== undefined) updateData.appPropertyName = config.appPropertyName;
    if (body.versionPropertyName !== undefined) {
      updateData.versionPropertyName = config.versionPropertyName;
    }
    if (body.statusPropertyName !== undefined) {
      updateData.statusPropertyName = config.statusPropertyName;
    }

    await db
      .update(notionSyncSettings)
      .set(updateData)
      .where(eq(notionSyncSettings.id, row.id));

    return { data: { ok: true, ...result } };
  } catch (err: any) {
    if (err instanceof NotionApiError) {
      throw createError({
        statusCode: err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502,
        message: err.message,
      });
    }
    throw createError({
      statusCode: 502,
      message: err?.message || "Failed to connect to Notion",
    });
  }
});
