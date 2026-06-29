CREATE TABLE "notion_sync_settings" (
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
--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "notion_page_id" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "notion_page_id" text;