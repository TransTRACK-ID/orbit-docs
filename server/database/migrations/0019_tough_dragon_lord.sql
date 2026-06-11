CREATE TABLE "doc_generation_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"srs_enabled" boolean DEFAULT true NOT NULL,
	"fsd_enabled" boolean DEFAULT true NOT NULL,
	"git_snapshot_enabled" boolean DEFAULT true NOT NULL,
	"sdd_index_enabled" boolean DEFAULT true NOT NULL,
	"sdd_per_repo_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_generation_debug_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "opencode_session_id" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "git_snapshot_content" text;--> statement-breakpoint
ALTER TABLE "doc_generation_debug_logs" ADD CONSTRAINT "doc_generation_debug_logs_job_id_doc_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."doc_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;