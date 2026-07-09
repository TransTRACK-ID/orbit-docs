ALTER TABLE "app_repositories" ADD COLUMN "auto_merge_docs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD COLUMN "pr_status" text;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD COLUMN "merge_error_message" text;