CREATE TABLE "doc_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_id" text NOT NULL,
	"version" text NOT NULL,
	"content" text DEFAULT '',
	"title" text,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;