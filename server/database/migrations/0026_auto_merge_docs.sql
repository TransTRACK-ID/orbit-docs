ALTER TABLE "app_repositories" ADD COLUMN IF NOT EXISTS "auto_merge_docs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD COLUMN IF NOT EXISTS "pr_status" text;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD COLUMN IF NOT EXISTS "merge_error_message" text;
