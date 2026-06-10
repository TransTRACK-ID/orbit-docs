ALTER TABLE "doc_generation_jobs" ADD COLUMN "current_activity" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "partial_content" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "tokens_input" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "tokens_output" integer DEFAULT 0 NOT NULL;