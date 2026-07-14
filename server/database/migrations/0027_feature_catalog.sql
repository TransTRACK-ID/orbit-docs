ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "docs_app_external_id_unique" ON "docs" ("app_id", "external_id") WHERE "external_id" IS NOT NULL;
