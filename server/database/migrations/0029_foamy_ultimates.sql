CREATE TABLE "doc_generation_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" text DEFAULT 'idle' NOT NULL,
	"last_run_job_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "doc_generation_schedule_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
ALTER TABLE "doc_generation_schedule" ADD CONSTRAINT "doc_generation_schedule_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;