CREATE TABLE "version_history" (
  "id" text PRIMARY KEY NOT NULL,
  "version_id" text NOT NULL REFERENCES "app_versions"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "action" text NOT NULL DEFAULT 'save',
  "actor" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX "version_history_version_id_idx" ON "version_history"("version_id");