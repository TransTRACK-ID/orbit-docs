ALTER TABLE "docs" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "doc_type" text;