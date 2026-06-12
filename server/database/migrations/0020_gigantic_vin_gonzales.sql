CREATE TABLE "doc_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_id" text NOT NULL,
	"app_id" text,
	"helpful" boolean NOT NULL,
	"comment" text,
	"status" text DEFAULT 'open' NOT NULL,
	"visitor_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_feedback" ADD CONSTRAINT "doc_feedback_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_feedback" ADD CONSTRAINT "doc_feedback_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;