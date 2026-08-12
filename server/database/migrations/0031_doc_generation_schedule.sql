CREATE TABLE IF NOT EXISTS "doc_generation_schedule" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "schedule_enabled" boolean DEFAULT false NOT NULL,
  "last_run_at" timestamp with time zone,
  "last_run_status" text DEFAULT 'idle' NOT NULL,
  "last_run_job_id" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "doc_generation_schedule_app_id_unique" ON "doc_generation_schedule" ("app_id");
