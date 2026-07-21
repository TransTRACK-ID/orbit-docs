CREATE TABLE IF NOT EXISTS "doc_sites" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text REFERENCES "apps"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'draft',
  "nav_config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "doc_sites_slug_unique" ON "doc_sites" ("slug");--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "site_id" text REFERENCES "doc_sites"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "frontmatter" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "docs_site_slug_unique" ON "docs" ("site_id", "slug") WHERE "slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docs_site_id_idx" ON "docs" ("site_id");
