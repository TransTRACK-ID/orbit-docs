CREATE TABLE "doc_generation_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"content" text DEFAULT '',
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_generation_versions" ADD CONSTRAINT "doc_generation_versions_job_id_doc_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."doc_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;