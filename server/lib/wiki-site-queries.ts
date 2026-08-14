import { getDb } from "~/server/database";
import { docSites, docs, apps } from "~/server/database/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import type { AuthContext } from "~/server/utils/rbac";
import { roleHasPermission } from "~/server/lib/permissions";

const PUBLISHED_STATUSES = ["published"] as const;

export function canReadDraftDocs(context: AuthContext): boolean {
  if (context.isSuperAdmin) return true;
  if (!context.role) return false;
  return roleHasPermission(context.role, "docs:read", context.matrix);
}

export async function loadWikiSiteBySlug(slug: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: docSites.id,
      appId: docSites.appId,
      name: docSites.name,
      slug: docSites.slug,
      description: docSites.description,
      status: docSites.status,
      navConfig: docSites.navConfig,
      openapiNormalized: docSites.openapiNormalized,
      updatedAt: docSites.updatedAt,
      appName: apps.name,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(eq(docSites.slug, slug))
    .limit(1);

  const site = rows[0];
  if (!site || site.status === "archived") return null;
  return site;
}

export async function loadWikiSitePages(siteId: string, includeDrafts: boolean) {
  const db = getDb();
  const conditions = [eq(docs.siteId, siteId), ne(docs.status, "archived")];
  if (!includeDrafts) {
    conditions.push(inArray(docs.status, [...PUBLISHED_STATUSES]));
  }

  return db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
      status: docs.status,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(and(...conditions))
    .orderBy(docs.sortOrder, docs.updatedAt);
}

export async function loadWikiPage(siteId: string, pageSlug: string, includeDrafts: boolean) {
  const db = getDb();
  const conditions = [
    eq(docs.siteId, siteId),
    eq(docs.slug, pageSlug),
    ne(docs.status, "archived"),
  ];
  if (!includeDrafts) {
    conditions.push(inArray(docs.status, [...PUBLISHED_STATUSES]));
  }

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      content: docs.content,
      slug: docs.slug,
      status: docs.status,
      frontmatter: docs.frontmatter,
      author: docs.author,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(and(...conditions))
    .limit(1);

  return rows[0] || null;
}
