CREATE TABLE "internal_app_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"user_id" text,
	"user_name" text NOT NULL,
	"user_email" text,
	"category" text DEFAULT 'general' NOT NULL,
	"comment" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "internal_app_feedback" ADD CONSTRAINT "internal_app_feedback_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;