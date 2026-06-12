ALTER TABLE "internal_app_feedback" DROP CONSTRAINT "internal_app_feedback_app_id_apps_id_fk";
--> statement-breakpoint
ALTER TABLE "internal_app_feedback" DROP COLUMN "app_id";