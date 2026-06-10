ALTER TABLE "doc_generation_jobs" ADD COLUMN IF NOT EXISTS "current_activity" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN IF NOT EXISTS "partial_content" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN IF NOT EXISTS "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN IF NOT EXISTS "tokens_input" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN IF NOT EXISTS "tokens_output" integer DEFAULT 0 NOT NULL;
