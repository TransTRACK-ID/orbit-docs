import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export type NotionSyncInterval = "hourly" | "daily";

export type NotionSyncResult = {
  docsCreated: number;
  docsUpdated: number;
  releasesCreated: number;
  releasesUpdated: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
};

export const notionSyncSettings = pgTable("notion_sync_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  apiKeyEncrypted: text("api_key_encrypted"),
  docsDatabaseId: text("docs_database_id"),
  releasesDatabaseId: text("releases_database_id"),
  appPropertyName: text("app_property_name").notNull().default("App"),
  versionPropertyName: text("version_property_name").notNull().default("Version"),
  statusPropertyName: text("status_property_name").notNull().default("Status"),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  scheduleInterval: text("schedule_interval", { enum: ["hourly", "daily"] })
    .notNull()
    .default("daily"),
  connected: boolean("connected").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status", { enum: ["idle", "running", "success", "error"] })
    .notNull()
    .default("idle"),
  lastSyncResult: jsonb("last_sync_result").$type<NotionSyncResult | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
