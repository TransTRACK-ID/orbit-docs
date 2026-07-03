CREATE TABLE "doc_generation_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"doc_key" text NOT NULL,
	"author_id" text,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"quote" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_generation_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"doc_key" text NOT NULL,
	"status" text DEFAULT 'in_review' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "releases" DROP CONSTRAINT "releases_version_id_app_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "share_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_generation_jobs" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "doc_generation_comments" ADD CONSTRAINT "doc_generation_comments_job_id_doc_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."doc_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_comments" ADD CONSTRAINT "doc_generation_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_generation_reviews" ADD CONSTRAINT "doc_generation_reviews_job_id_doc_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."doc_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_generation_reviews_job_doc_unique" ON "doc_generation_reviews" USING btree ("job_id","doc_key");--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE set null ON UPDATE no action;