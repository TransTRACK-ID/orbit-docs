ALTER TABLE "doc_sites" ADD COLUMN IF NOT EXISTS "openapi_spec" text;--> statement-breakpoint
ALTER TABLE "doc_sites" ADD COLUMN IF NOT EXISTS "openapi_format" text;--> statement-breakpoint
ALTER TABLE "doc_sites" ADD COLUMN IF NOT EXISTS "openapi_normalized" jsonb;
