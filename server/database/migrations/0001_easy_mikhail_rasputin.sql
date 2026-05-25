CREATE TABLE "owners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "actor" text NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN "user";