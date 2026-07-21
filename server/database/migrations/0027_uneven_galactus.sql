CREATE TABLE "doc_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"nav_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "doc_sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "frontmatter" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_sites" ADD CONSTRAINT "doc_sites_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_site_id_doc_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."doc_sites"("id") ON DELETE set null ON UPDATE no action;