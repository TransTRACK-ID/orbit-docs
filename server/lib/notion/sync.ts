import { eq, and } from "drizzle-orm";
import { getDb } from "~/server/database";
import {
  apps,
  appVersions,
  docs,
  releases,
  notionSyncSettings,
  type NotionSyncResult,
} from "~/server/database/schema";
import { decryptSecret } from "~/server/utils/secret-crypto";
import {
  NotionClient,
  getTitleFromPage,
  findPropertyByName,
  getPropertyText,
  type NotionPage,
} from "./client";
import { parseReleaseCategories } from "./blocks-to-markdown";
import { resolveAppName, resolveVersionLabel, normalizeAppMatchKey, extractParentheticalAlias, normalizeVersionLabel } from "./resolve-app";

export interface NotionSyncConfig {
  apiKey: string;
  docsDatabaseId: string | null;
  releasesDatabaseId: string | null;
  appPropertyName: string;
  versionPropertyName: string;
  statusPropertyName: string;
}

export async function getNotionSyncRow() {
  const db = getDb();
  let rows = await db.select().from(notionSyncSettings).limit(1);
  if (rows.length === 0) {
    const inserted = await db
      .insert(notionSyncSettings)
      .values({ id: crypto.randomUUID() })
      .returning();
    rows = inserted;
  }
  return rows[0];
}

export async function loadNotionSyncConfig(): Promise<NotionSyncConfig | null> {
  const row = await getNotionSyncRow();
  if (!row.apiKeyEncrypted) return null;
  return {
    apiKey: decryptSecret(row.apiKeyEncrypted),
    docsDatabaseId: row.docsDatabaseId,
    releasesDatabaseId: row.releasesDatabaseId,
    appPropertyName: row.appPropertyName,
    versionPropertyName: row.versionPropertyName,
    statusPropertyName: row.statusPropertyName,
  };
}

function mapDocStatus(notionStatus: string): "draft" | "in_review" | "published" | "archived" {
  const s = notionStatus.trim().toLowerCase();
  if (s === "published" || s === "done" || s === "live") return "published";
  if (s === "in review" || s === "review") return "in_review";
  if (s === "archived") return "archived";
  return "draft";
}

async function resolveAppByName(appName: string) {
  const db = getDb();
  const trimmed = appName.trim();
  if (!trimmed) return null;
  const allApps = await db.select().from(apps);
  const target = normalizeAppMatchKey(trimmed);

  const exact = allApps.find((a) => normalizeAppMatchKey(a.name) === target);
  if (exact) return exact;

  const alias = extractParentheticalAlias(trimmed);
  if (alias) {
    const aliasMatch = allApps.find((a) => normalizeAppMatchKey(a.name) === normalizeAppMatchKey(alias));
    if (aliasMatch) return aliasMatch;
  }

  const partial = allApps.find((a) => {
    const appKey = normalizeAppMatchKey(a.name);
    return target.includes(appKey) || appKey.includes(target);
  });
  if (partial) return partial;

  return null;
}

async function findOrCreateVersion(appId: string, versionLabel: string) {
  const db = getDb();
  const version = normalizeVersionLabel(versionLabel);
  if (!version) return null;

  const existing = await db
    .select()
    .from(appVersions)
    .where(and(eq(appVersions.appId, appId), eq(appVersions.version, version)))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) return existing;

  const [created] = await db
    .insert(appVersions)
    .values({
      appId,
      version,
      status: "draft",
      createdBy: "Notion Sync",
    })
    .returning();
  return created;
}

async function syncDocPage(
  client: NotionClient,
  page: NotionPage,
  config: NotionSyncConfig,
  result: NotionSyncResult
) {
  const db = getDb();
  const title = getTitleFromPage(page);
  const resolvedApp = await resolveAppName(client, page, config.appPropertyName);
  const app = resolvedApp ? await resolveAppByName(resolvedApp.appName) : null;
  if (!app) {
    const hint = resolvedApp
      ? `no Orbit app matches "${resolvedApp.appName}" (from ${resolvedApp.source === "property" ? "Product Domain" : "title"})`
      : `App property "${config.appPropertyName}" is empty and title could not be parsed`;
    result.errors.push(`Doc "${title}": ${hint}. Create a matching app in Orbit Apps.`);
    return;
  }

  const statusRaw = await getPropertyText(
    client,
    findPropertyByName(page.properties, config.statusPropertyName)
  );
  const content = await client.getPageMarkdown(page.id);
  const status = mapDocStatus(statusRaw);

  const existing = await db
    .select()
    .from(docs)
    .where(eq(docs.notionPageId, page.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    await db
      .update(docs)
      .set({
        title,
        content,
        status,
        appId: app.id,
        updatedAt: new Date(),
      })
      .where(eq(docs.id, existing.id));
    result.docsUpdated += 1;
    return;
  }

  await db.insert(docs).values({
    title,
    content,
    status,
    appId: app.id,
    notionPageId: page.id,
    source: "manual",
    author: "Notion Sync",
  });
  result.docsCreated += 1;
}

async function syncReleasePage(
  client: NotionClient,
  page: NotionPage,
  config: NotionSyncConfig,
  result: NotionSyncResult
) {
  const db = getDb();
  const title = getTitleFromPage(page);
  const resolvedApp = await resolveAppName(client, page, config.appPropertyName);
  const versionLabel = await resolveVersionLabel(client, page, config.versionPropertyName, title);

  const app = resolvedApp ? await resolveAppByName(resolvedApp.appName) : null;
  if (!app) {
    const hint = resolvedApp
      ? `no Orbit app matches "${resolvedApp.appName}" (from ${resolvedApp.source === "property" ? "Product Domain" : "title"})`
      : `App property "${config.appPropertyName}" is empty and title could not be parsed`;
    result.errors.push(`Release "${title}": ${hint}. Create a matching app in Orbit Apps.`);
    return;
  }

  const version = await findOrCreateVersion(app.id, versionLabel);
  if (!version) {
    result.errors.push(`Release "${title}": could not create version`);
    return;
  }

  const body = await client.getPageMarkdown(page.id);
  const categories = parseReleaseCategories(body);
  const hasCategories = Object.values(categories).some((items) => items.length > 0);
  const releaseType = hasCategories ? "normal" : "article";
  const summary = hasCategories ? null : body;
  const statusRaw = await getPropertyText(
    client,
    findPropertyByName(page.properties, config.statusPropertyName)
  );
  const published = ["published", "done", "live"].includes(statusRaw.trim().toLowerCase());

  const existing = await db
    .select()
    .from(releases)
    .where(eq(releases.notionPageId, page.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    await db
      .update(releases)
      .set({
        appId: app.id,
        versionId: version.id,
        heroTitle: title,
        summary,
        categories: hasCategories ? categories : null,
        type: releaseType,
        published,
        updatedAt: new Date(),
      })
      .where(eq(releases.id, existing.id));
    result.releasesUpdated += 1;
    return;
  }

  const conflicting = await db
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.versionId, version.id), eq(releases.type, releaseType)))
    .limit(1)
    .then((rows) => rows[0]);

  if (conflicting) {
    await db
      .update(releases)
      .set({
        appId: app.id,
        versionId: version.id,
        heroTitle: title,
        summary,
        categories: hasCategories ? categories : null,
        type: releaseType,
        published,
        notionPageId: page.id,
        updatedAt: new Date(),
      })
      .where(eq(releases.id, conflicting.id));
    result.releasesUpdated += 1;
    return;
  }

  await db.insert(releases).values({
    appId: app.id,
    versionId: version.id,
    heroTitle: title,
    summary,
    categories: hasCategories ? categories : null,
    type: releaseType,
    published,
    notionPageId: page.id,
  });
  result.releasesCreated += 1;
}

export async function runNotionSync(): Promise<NotionSyncResult> {
  const db = getDb();
  const row = await getNotionSyncRow();

  if (row.lastSyncStatus === "running") {
    throw new Error("A sync is already in progress");
  }

  const config = await loadNotionSyncConfig();
  if (!config) {
    throw new Error("Notion integration is not configured");
  }
  if (!config.docsDatabaseId && !config.releasesDatabaseId) {
    throw new Error("At least one Notion database ID is required");
  }

  const startedAt = new Date().toISOString();
  const result: NotionSyncResult = {
    docsCreated: 0,
    docsUpdated: 0,
    releasesCreated: 0,
    releasesUpdated: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  await db
    .update(notionSyncSettings)
    .set({ lastSyncStatus: "running", updatedAt: new Date() })
    .where(eq(notionSyncSettings.id, row.id));

  try {
    const client = new NotionClient(config.apiKey);

    if (config.docsDatabaseId) {
      const pages = await client.queryDatabase(config.docsDatabaseId);
      for (const page of pages) {
        try {
          await syncDocPage(client, page, config, result);
        } catch (err: any) {
          const pageTitle = getTitleFromPage(page);
          result.errors.push(`Doc "${pageTitle}": ${err?.message || "sync failed"}`);
        }
      }
    }

    if (config.releasesDatabaseId) {
      const pages = await client.queryDatabase(config.releasesDatabaseId);
      for (const page of pages) {
        try {
          await syncReleasePage(client, page, config, result);
        } catch (err: any) {
          const pageTitle = getTitleFromPage(page);
          result.errors.push(`Release "${pageTitle}": ${err?.message || "sync failed"}`);
        }
      }
    }

    result.finishedAt = new Date().toISOString();
    const status = result.errors.length > 0 ? "error" : "success";

    await db
      .update(notionSyncSettings)
      .set({
        lastSyncStatus: status,
        lastSyncAt: new Date(),
        lastSyncResult: result,
        updatedAt: new Date(),
      })
      .where(eq(notionSyncSettings.id, row.id));

    return result;
  } catch (err: any) {
    result.finishedAt = new Date().toISOString();
    result.errors.push(err?.message || "Sync failed");
    await db
      .update(notionSyncSettings)
      .set({
        lastSyncStatus: "error",
        lastSyncAt: new Date(),
        lastSyncResult: result,
        updatedAt: new Date(),
      })
      .where(eq(notionSyncSettings.id, row.id));
    throw err;
  }
}

const APP_PROPERTY_TYPES = new Set([
  "select",
  "status",
  "rich_text",
  "relation",
  "multi_select",
]);

export async function testNotionConnection(config: NotionSyncConfig): Promise<{
  docsDatabaseTitle?: string;
  releasesDatabaseTitle?: string;
  appPropertyOptions: string[];
  allPropertyOptions: string[];
}> {
  const client = new NotionClient(config.apiKey);
  let docsDatabaseTitle: string | undefined;
  let releasesDatabaseTitle: string | undefined;
  const appPropertyOptions = new Set<string>();
  const allPropertyOptions = new Set<string>();

  if (config.docsDatabaseId) {
    const dbInfo = await client.getDatabase(config.docsDatabaseId);
    docsDatabaseTitle = dbInfo.title.map((t) => t.plain_text).join("") || "Docs database";
    for (const prop of Object.values(dbInfo.properties)) {
      allPropertyOptions.add(prop.name);
      if (APP_PROPERTY_TYPES.has(prop.type)) {
        appPropertyOptions.add(prop.name);
      }
    }
  }

  if (config.releasesDatabaseId) {
    const dbInfo = await client.getDatabase(config.releasesDatabaseId);
    releasesDatabaseTitle = dbInfo.title.map((t) => t.plain_text).join("") || "Releases database";
    for (const prop of Object.values(dbInfo.properties)) {
      allPropertyOptions.add(prop.name);
      if (APP_PROPERTY_TYPES.has(prop.type)) {
        appPropertyOptions.add(prop.name);
      }
    }
  }

  return {
    docsDatabaseTitle,
    releasesDatabaseTitle,
    appPropertyOptions: Array.from(appPropertyOptions).sort(),
    allPropertyOptions: Array.from(allPropertyOptions).sort(),
  };
}
