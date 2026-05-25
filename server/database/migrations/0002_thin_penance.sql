CREATE TABLE "doc_embeds" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text,
	"version_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"subtitle" text,
	"nav_items" jsonb DEFAULT '[]'::jsonb,
	"content" text DEFAULT '',
	"status" text DEFAULT 'draft' NOT NULL,
	"author" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "doc_embeds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "docs" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text,
	"title" text NOT NULL,
	"content" text DEFAULT '',
	"status" text DEFAULT 'draft' NOT NULL,
	"version_id" text,
	"tags" text[] DEFAULT '{}',
	"author" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"production_key" text DEFAULT 'od_live_••••••••••••••••••••••••' NOT NULL,
	"webhook_secret" text DEFAULT 'whsec_••••••••••••••••••••••••' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"github_actions" boolean DEFAULT false NOT NULL,
	"gitlab_ci" boolean DEFAULT false NOT NULL,
	"jenkins" boolean DEFAULT false NOT NULL,
	"circle_ci" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"email_digest" boolean DEFAULT true NOT NULL,
	"release_alerts" boolean DEFAULT true NOT NULL,
	"doc_comments" boolean DEFAULT false NOT NULL,
	"slack_notifications" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"initials" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by" text,
	"user_id" text,
	"last_active" text DEFAULT 'just now' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Acme Engineering' NOT NULL,
	"slug" text DEFAULT 'acme-engineering' NOT NULL,
	"description" text DEFAULT 'Internal documentation platform for product and engineering teams.',
	"theme" text DEFAULT 'light' NOT NULL,
	"logo_url" text,
	"public_docs_access" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"version_id" text NOT NULL,
	"hero_title" text,
	"summary" text,
	"features" jsonb,
	"categories" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "release_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "release_notes" text;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "commit_hash" text;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "approver" text;--> statement-breakpoint
ALTER TABLE "app_versions" ADD COLUMN "ci_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_embeds" ADD CONSTRAINT "doc_embeds_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_embeds" ADD CONSTRAINT "doc_embeds_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE cascade ON UPDATE no action;