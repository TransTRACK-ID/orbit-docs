import type { H3Event } from "h3";
import { getDb } from "~/server/database";
import { workspaceSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { sanitizeBrandLogoUrl } from "~/utils/brand-logo-url";

export async function ensurePublicDocsAccess(event: H3Event): Promise<void> {
  const db = getDb();
  const settingsRows = await db.select().from(workspaceSettings).limit(1);
  const isPublic = settingsRows[0]?.publicDocsAccess ?? true;
  if (!isPublic) {
    await requireAuth(event);
  }
}

export async function getPublicWorkspace() {
  const db = getDb();
  const rows = await db
    .select({
      name: workspaceSettings.name,
      slug: workspaceSettings.slug,
      description: workspaceSettings.description,
      logoUrl: workspaceSettings.logoUrl,
    })
    .from(workspaceSettings)
    .limit(1);

  const row = rows[0] || {
    name: "Orbit Docs",
    slug: "orbit-docs",
    description: "Product documentation and release notes.",
    logoUrl: null as string | null,
  };

  return {
    ...row,
    logoUrl: sanitizeBrandLogoUrl(row.logoUrl),
  };
}
