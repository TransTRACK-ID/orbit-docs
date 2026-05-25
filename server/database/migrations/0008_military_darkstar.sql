CREATE TABLE "version_history" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"content" text NOT NULL,
	"action" text DEFAULT 'save' NOT NULL,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "version_history" ADD CONSTRAINT "version_history_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE cascade ON UPDATE no action;