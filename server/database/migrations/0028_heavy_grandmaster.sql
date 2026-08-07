CREATE TABLE "role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doc_sites" ADD COLUMN "openapi_spec" text;--> statement-breakpoint
ALTER TABLE "doc_sites" ADD COLUMN "openapi_format" text;--> statement-breakpoint
ALTER TABLE "doc_sites" ADD COLUMN "openapi_normalized" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions" USING btree ("role","permission");