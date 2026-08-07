import { and, count, eq, ilike, sql } from "drizzle-orm";
import type { getDb } from "~/server/database";
import * as schema from "~/server/database/schema";
import {
  buildDocSitePublicUrls,
  getPublicAppBaseUrl,
} from "~/server/lib/mcp-public-urls";

type Db = ReturnType<typeof getDb>;

export const mcpDocSelectFields = {
  id: schema.docs.id,
  appId: schema.docs.appId,
  title: schema.docs.title,
  content: schema.docs.content,
  status: schema.docs.status,
  versionId: schema.docs.versionId,
  tags: schema.docs.tags,
  author: schema.docs.author,
  source: schema.docs.source,
  docType: schema.docs.docType,
  externalId: schema.docs.externalId,
  siteId: schema.docs.siteId,
  slug: schema.docs.slug,
  frontmatter: schema.docs.frontmatter,
  createdAt: schema.docs.createdAt,
  updatedAt: schema.docs.updatedAt,
  appName: schema.apps.name,
  version: schema.appVersions.version,
  siteName: schema.docSites.name,
  siteSlug: schema.docSites.slug,
  siteStatus: schema.docSites.status,
} as const;

export function mcpDocSelectQuery(db: Db) {
  return db
    .select(mcpDocSelectFields)
    .from(schema.docs)
    .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
    .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
    .leftJoin(schema.docSites, eq(schema.docs.siteId, schema.docSites.id));
}

export function formatMcpPublicContext() {
  const baseUrl = getPublicAppBaseUrl();
  return {
    publicBaseUrl: baseUrl || null,
    publicUrlNote: baseUrl
      ? "publicUrl fields are absolute shareable links."
      : "Set NUXT_PUBLIC_APP_URL to return absolute publicUrl values; publicPath is always available for published content.",
  };
}

export function formatMcpDocSite(site: {
  id: string;
  appId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  navConfig?: unknown;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  appName?: string | null;
}) {
  const publicLinks = buildDocSitePublicUrls({
    slug: site.slug,
    status: site.status,
  });

  return {
    id: site.id,
    appId: site.appId,
    name: site.name,
    slug: site.slug,
    description: site.description,
    status: site.status,
    navConfig: site.navConfig ?? null,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    app: site.appName && site.appId ? { id: site.appId, name: site.appName } : null,
    publicPath: publicLinks.path,
    publicUrl: publicLinks.url,
  };
}

export interface ResolvedAppRef {
  id: string | null;
  name: string | null;
  found: boolean;
}

export interface AppDocCounts {
  total: number;
  draft: number;
  in_review: number;
  published: number;
  archived: number;
  product: number;
  knowledge: number;
}

export function knowledgeDocCondition() {
  return and(
    eq(schema.docs.source, "op_sync"),
    eq(schema.docs.docType, "feature"),
  );
}

export function productDocCondition() {
  return sql`NOT (${schema.docs.source} = 'op_sync' AND ${schema.docs.docType} = 'feature')`;
}

export function docCategoryCondition(category?: "product" | "knowledge") {
  if (!category) return undefined;
  if (category === "knowledge") return knowledgeDocCondition();
  return productDocCondition();
}

export async function resolveAppRef(
  db: Db,
  params: { appId?: string; appName?: string },
): Promise<ResolvedAppRef> {
  if (params.appId) {
    const app = await db
      .select({ id: schema.apps.id, name: schema.apps.name })
      .from(schema.apps)
      .where(eq(schema.apps.id, params.appId))
      .limit(1)
      .then((rows) => rows[0]);

    if (app) {
      return { id: app.id, name: app.name, found: true };
    }

    return { id: params.appId, name: null, found: false };
  }

  if (params.appName?.trim()) {
    const app = await db
      .select({ id: schema.apps.id, name: schema.apps.name })
      .from(schema.apps)
      .where(ilike(schema.apps.name, `%${params.appName.trim()}%`))
      .orderBy(schema.apps.name)
      .limit(1)
      .then((rows) => rows[0]);

    if (app) {
      return { id: app.id, name: app.name, found: true };
    }

    return { id: null, name: params.appName.trim(), found: false };
  }

  return { id: null, name: null, found: false };
}

export async function getAppDocCounts(db: Db, appId: string): Promise<AppDocCounts> {
  const base = eq(schema.docs.appId, appId);

  const [
    totalResult,
    draftResult,
    inReviewResult,
    publishedResult,
    archivedResult,
    productResult,
    knowledgeResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(schema.docs).where(base),
    db
      .select({ count: count() })
      .from(schema.docs)
      .where(and(base, eq(schema.docs.status, "draft"))),
    db
      .select({ count: count() })
      .from(schema.docs)
      .where(and(base, eq(schema.docs.status, "in_review"))),
    db
      .select({ count: count() })
      .from(schema.docs)
      .where(and(base, eq(schema.docs.status, "published"))),
    db
      .select({ count: count() })
      .from(schema.docs)
      .where(and(base, eq(schema.docs.status, "archived"))),
    db.select({ count: count() }).from(schema.docs).where(and(base, productDocCondition())),
    db.select({ count: count() }).from(schema.docs).where(and(base, knowledgeDocCondition())),
  ]);

  return {
    total: totalResult[0]?.count ?? 0,
    draft: draftResult[0]?.count ?? 0,
    in_review: inReviewResult[0]?.count ?? 0,
    published: publishedResult[0]?.count ?? 0,
    archived: archivedResult[0]?.count ?? 0,
    product: productResult[0]?.count ?? 0,
    knowledge: knowledgeResult[0]?.count ?? 0,
  };
}

export async function countDocsForFilters(
  db: Db,
  conditions: unknown[],
): Promise<number> {
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const result = await db
    .select({ count: count() })
    .from(schema.docs)
    .where(whereClause);

  return result[0]?.count ?? 0;
}

export function buildListDocsHint(params: {
  app: ResolvedAppRef;
  total: number;
  count: number;
  status?: string;
  category?: "product" | "knowledge";
  docCounts?: AppDocCounts;
}): string | null {
  if (params.app.id && !params.app.found) {
    return "App ID was not found. Use list_apps with search or pass appName to resolve the correct app.";
  }

  if (params.app.found && params.total === 0) {
    return "This app has no documentation rows yet. Product docs and knowledge-base features are created separately.";
  }

  if (params.count === 0 && params.total > 0) {
    const parts = [`${params.total} docs match the app`];
    if (params.status && params.docCounts) {
      parts.push(
        `status breakdown: draft=${params.docCounts.draft}, in_review=${params.docCounts.in_review}, published=${params.docCounts.published}, archived=${params.docCounts.archived}`,
      );
    }
    if (params.category && params.docCounts) {
      parts.push(
        `category breakdown: product=${params.docCounts.product}, knowledge=${params.docCounts.knowledge}`,
      );
    }
    parts.push("Try list_app_documentation for the grouped /docs view.");
    return parts.join("; ");
  }

  if (params.total > params.count) {
    return `Showing ${params.count} of ${params.total} docs. Increase limit/offset to paginate.`;
  }

  return null;
}
