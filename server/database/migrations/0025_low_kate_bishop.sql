CREATE TABLE "release_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"hero_title" text,
	"summary" text,
	"published" boolean DEFAULT false NOT NULL,
	"action" text DEFAULT 'save' NOT NULL,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_versions" ADD COLUMN "action" text DEFAULT 'save' NOT NULL;--> statement-breakpoint
ALTER TABLE "release_versions" ADD CONSTRAINT "release_versions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;