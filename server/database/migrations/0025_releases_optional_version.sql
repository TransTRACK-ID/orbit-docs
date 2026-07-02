ALTER TABLE "releases" ALTER COLUMN "version_id" DROP NOT NULL;
ALTER TABLE "releases" DROP CONSTRAINT IF EXISTS "releases_version_id_app_versions_id_fk";
ALTER TABLE "releases" ADD CONSTRAINT "releases_version_id_app_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."app_versions"("id") ON DELETE set null ON UPDATE no action;
