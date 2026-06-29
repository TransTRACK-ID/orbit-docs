CREATE TABLE IF NOT EXISTS "notion_sync_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "api_key_encrypted" text,
  "docs_database_id" text,
  "releases_database_id" text,
  "app_property_name" text DEFAULT 'App' NOT NULL,
  "version_property_name" text DEFAULT 'Version' NOT NULL,
  "status_property_name" text DEFAULT 'Status' NOT NULL,
  "schedule_enabled" boolean DEFAULT false NOT NULL,
  "schedule_interval" text DEFAULT 'daily' NOT NULL,
  "connected" boolean DEFAULT false NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_sync_status" text DEFAULT 'idle' NOT NULL,
  "last_sync_result" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "notion_page_id" text;
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "notion_page_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "docs_notion_page_id_unique" ON "docs" ("notion_page_id") WHERE "notion_page_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "releases_notion_page_id_unique" ON "releases" ("notion_page_id") WHERE "notion_page_id" IS NOT NULL;
