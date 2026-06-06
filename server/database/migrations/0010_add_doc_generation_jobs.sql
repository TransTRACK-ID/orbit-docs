CREATE TABLE "doc_generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"user_id" text NOT NULL,
	"repo_url" text NOT NULL,
	"status" text DEFAULT 'cloning' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"progress_message" text DEFAULT 'Initializing...',
	"srs_content" text,
	"fsd_content" text,
	"sdd_content" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD CONSTRAINT "doc_generation_jobs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD CONSTRAINT "doc_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;