CREATE TABLE "app_repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"repo_url" text NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"host_url" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"access_token" text,
	"webhook_secret" text,
	"sdd_doc_path" text DEFAULT 'docs/SDD.md' NOT NULL,
	"last_processed_ref" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_generation_repo_results" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"repo_id" text,
	"repo_url" text NOT NULL,
	"repo_ref" text,
	"sdd_content" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"pr_url" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ALTER COLUMN "repo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "scope" text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "trigger" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "repo_id" text;--> statement-breakpoint
ALTER TABLE "app_repositories" ADD CONSTRAINT "app_repositories_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD CONSTRAINT "doc_generation_repo_results_job_id_doc_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."doc_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_repo_results" ADD CONSTRAINT "doc_generation_repo_results_repo_id_app_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."app_repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD CONSTRAINT "doc_generation_jobs_repo_id_app_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."app_repositories"("id") ON DELETE set null ON UPDATE no action;