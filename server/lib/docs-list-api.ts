import { and, count, desc, eq, or, sql } from "drizzle-orm";
import type { getDb } from "~/server/database";
import { apps, appVersions, docSites, docs } from "~/server/database/schema";
import type { DocListView } from "~/utils/doc-display";
import { DOCS_LIST_MAX_PAGE_SIZE } from "~/utils/docs-list-constants";
import { knowledgeDocCondition } from "~/server/lib/mcp-doc-queries";

type Db = ReturnType<typeof getDb>;

const DOCS_LIST_MAX_LIMIT = DOCS_LIST_MAX_PAGE_SIZE;

export interface DocsListQueryFilters {
  search?: string;
  appId?: string;
  status?: string;
  siteId?: string;
  view?: DocListView;
  unboundOnly?: boolean;
}

export interface DocsListPagination {
  limit?: number;
  offset: number;
  includeContent: boolean;
}

export function parseDocsListPagination(query: Record<string, unknown>): DocsListPagination {
  const limitRaw = query.limit;
  let limit: number | undefined;
  if (typeof limitRaw === "string" && limitRaw.length > 0) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(DOCS_LIST_MAX_LIMIT, parsed);
    }
  }

  const offsetRaw = query.offset;
  let offset = 0;
  if (typeof offsetRaw === "string" && offsetRaw.length > 0) {
    const parsed = Number.parseInt(offsetRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      offset = parsed;
    }
  }

  const includeContent = query.includeContent === "true";
  return { limit, offset, includeContent };
}

export function parseDocsListFilters(query: Record<string, unknown>): DocsListQueryFilters {
  const viewRaw = typeof query.view === "string" ? query.view : "";
  const view =
    viewRaw === "all" || viewRaw === "product" || viewRaw === "knowledge" || viewRaw === "adrs"
      ? viewRaw
      : undefined;

  return {
    search: typeof query.search === "string" ? query.search : "",
    appId: typeof query.appId === "string" ? query.appId : "",
    status: typeof query.status === "string" ? query.status : "",
    siteId: typeof query.siteId === "string" ? query.siteId : "",
    view,
    unboundOnly: query.unboundOnly === "true",
  };
}

function publishedAdrCondition() {
  return and(eq(docs.docType, "adr"), eq(docs.status, "published"));
}

function visibleAdrCondition(includeDraftAdrs: boolean) {
  if (includeDraftAdrs) return eq(docs.docType, "adr");
  return publishedAdrCondition();
}

/** SQL filter aligned with `filterDocsByView` in `utils/doc-display.ts`. */
export function buildDocsViewCondition(view: DocListView, includeDraftAdrs: boolean) {
  if (view === "knowledge") return knowledgeDocCondition();
  if (view === "product") {
    return and(
      sql`(${docs.docType} IS NULL OR ${docs.docType} <> 'adr')`,
      sql`NOT (${docs.source} = 'op_sync' AND ${docs.docType} = 'feature')`,
    );
  }
  if (view === "adrs") return visibleAdrCondition(includeDraftAdrs);
  return or(
    sql`(${docs.docType} IS NULL OR ${docs.docType} <> 'adr')`,
    visibleAdrCondition(includeDraftAdrs),
  );
}

export function buildDocsListConditions(
  filters: DocsListQueryFilters,
  includeDraftAdrs: boolean,
) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.search) {
    conditions.push(sql`${docs.title} ILIKE ${"%" + filters.search + "%"}`);
  }
  if (filters.appId) {
    conditions.push(eq(docs.appId, filters.appId));
  }
  if (filters.unboundOnly) {
    conditions.push(sql`${docs.appId} IS NULL`);
  }
  if (filters.status) {
    conditions.push(eq(docs.status, filters.status as "draft" | "in_review" | "published" | "archived"));
  }
  if (filters.siteId) {
    conditions.push(eq(docs.siteId, filters.siteId));
  }
  if (filters.view) {
    conditions.push(buildDocsViewCondition(filters.view, includeDraftAdrs));
  }

  return conditions;
}

const docListSelectFields = {
  id: docs.id,
  appId: docs.appId,
  title: docs.title,
  content: docs.content,
  status: docs.status,
  versionId: docs.versionId,
  tags: docs.tags,
  author: docs.author,
  source: docs.source,
  docType: docs.docType,
  frontmatter: docs.frontmatter,
  externalId: docs.externalId,
  siteId: docs.siteId,
  slug: docs.slug,
  createdAt: docs.createdAt,
  updatedAt: docs.updatedAt,
  appName: apps.name,
  version: appVersions.version,
  siteName: docSites.name,
  siteSlug: docSites.slug,
} as const;

export function mapDocListRow(
  row: {
    id: string;
    appId: string | null;
    title: string;
    content: string | null;
    status: string;
    versionId: string | null;
    tags: string[] | null;
    author: string | null;
    source: string;
    docType: string | null;
    frontmatter: Record<string, unknown> | null;
    externalId: string | null;
    siteId: string | null;
    slug: string | null;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
    appName: string | null;
    version: string | null;
    siteName: string | null;
    siteSlug: string | null;
  },
  options: { includeContent: boolean; includeDraftAdrs: boolean; applyLegacyAdrFilter: boolean },
) {
  if (options.applyLegacyAdrFilter && row.docType === "adr") {
    if (row.status !== "published" && !options.includeDraftAdrs) {
      return null;
    }
  }

  const item = {
    id: row.id,
    appId: row.appId,
    title: row.title,
    content: options.includeContent ? row.content : null,
    status: row.status,
    versionId: row.versionId,
    tags: row.tags,
    author: row.author,
    source: row.source,
    docType: row.docType,
    frontmatter: row.frontmatter,
    externalId: row.externalId,
    siteId: row.siteId,
    slug: row.slug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName && row.appId ? { id: row.appId, name: row.appName } : null,
    version: row.version && row.versionId ? { id: row.versionId, version: row.version } : null,
    site: row.siteId ? { id: row.siteId, name: row.siteName, slug: row.siteSlug } : null,
  };

  return item;
}

export async function queryDocsList(
  db: Db,
  filters: DocsListQueryFilters,
  pagination: DocsListPagination,
  includeDraftAdrs: boolean,
) {
  const conditions = buildDocsListConditions(filters, includeDraftAdrs);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const applyLegacyAdrFilter = !filters.view;

  const totalResult = await db
    .select({ count: count() })
    .from(docs)
    .where(whereClause);
  let total = totalResult[0]?.count ?? 0;

  if (applyLegacyAdrFilter && !includeDraftAdrs) {
    const draftAdrResult = await db
      .select({ count: count() })
      .from(docs)
      .where(
        and(
          whereClause,
          eq(docs.docType, "adr"),
          sql`${docs.status} <> 'published'`,
        ),
      );
    total -= draftAdrResult[0]?.count ?? 0;
  }

  let query = db
    .select(docListSelectFields)
    .from(docs)
    .leftJoin(apps, eq(docs.appId, apps.id))
    .leftJoin(appVersions, eq(docs.versionId, appVersions.id))
    .leftJoin(docSites, eq(docs.siteId, docSites.id))
    .where(whereClause)
    .orderBy(desc(docs.updatedAt))
    .$dynamic();

  if (pagination.limit != null) {
    query = query.limit(pagination.limit).offset(pagination.offset);
  }

  const rows = await query;
  const data = rows
    .map((row) =>
      mapDocListRow(row, {
        includeContent: pagination.includeContent,
        includeDraftAdrs,
        applyLegacyAdrFilter,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null);

  return { data, total, limit: pagination.limit ?? null, offset: pagination.offset };
}

export interface DocsListSummaryAppRow {
  id: string;
  name: string;
  count: number;
}

export interface DocsListSummary {
  viewCounts: Record<DocListView, number>;
  apps: DocsListSummaryAppRow[];
  unboundCount: number;
  workspaceAdrCount: number;
  stats: { total: number; drafts: number; systems: number };
}

function workspaceAdrCondition(includeDraftAdrs: boolean) {
  return and(
    eq(docs.docType, "adr"),
    sql`${docs.appId} IS NULL`,
    visibleAdrCondition(includeDraftAdrs),
  );
}

function draftStatCondition(activeView: DocListView, includeDraftAdrs: boolean) {
  return and(
    buildDocsViewCondition(activeView, includeDraftAdrs),
    eq(docs.status, "draft"),
    sql`NOT (${docs.source} = 'op_sync' AND ${docs.docType} = 'feature')`,
    sql`(${docs.docType} IS NULL OR ${docs.docType} <> 'adr')`,
  );
}

async function queryDocsAggregateCounts(
  db: Db,
  baseConditions: ReturnType<typeof buildDocsListConditions>,
  activeView: DocListView,
  includeDraftAdrs: boolean,
) {
  const baseWhere = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const [row] = await db
    .select({
      all: sql<number>`count(*) filter (where ${buildDocsViewCondition("all", includeDraftAdrs)})`.mapWith(Number),
      product: sql<number>`count(*) filter (where ${buildDocsViewCondition("product", includeDraftAdrs)})`.mapWith(Number),
      knowledge: sql<number>`count(*) filter (where ${buildDocsViewCondition("knowledge", includeDraftAdrs)})`.mapWith(Number),
      adrs: sql<number>`count(*) filter (where ${buildDocsViewCondition("adrs", includeDraftAdrs)})`.mapWith(Number),
      workspaceAdrCount: sql<number>`count(*) filter (where ${workspaceAdrCondition(includeDraftAdrs)})`.mapWith(Number),
      drafts: sql<number>`count(*) filter (where ${draftStatCondition(activeView, includeDraftAdrs)})`.mapWith(Number),
    })
    .from(docs)
    .where(baseWhere);

  return {
    viewCounts: {
      all: row?.all ?? 0,
      product: row?.product ?? 0,
      knowledge: row?.knowledge ?? 0,
      adrs: row?.adrs ?? 0,
    },
    workspaceAdrCount: row?.workspaceAdrCount ?? 0,
    drafts: row?.drafts ?? 0,
  };
}

export async function queryDocsListSummary(
  db: Db,
  filters: Omit<DocsListQueryFilters, "view">,
  activeView: DocListView,
  includeDraftAdrs: boolean,
  allApps: { id: string; name: string }[],
): Promise<DocsListSummary> {
  const baseConditions = buildDocsListConditions({ ...filters }, includeDraftAdrs);
  const viewWhere = and(...baseConditions, buildDocsViewCondition(activeView, includeDraftAdrs));

  const [aggregates, grouped] = await Promise.all([
    queryDocsAggregateCounts(db, baseConditions, activeView, includeDraftAdrs),
    db
      .select({ appId: docs.appId, docCount: count() })
      .from(docs)
      .where(viewWhere)
      .groupBy(docs.appId),
  ]);

  const { viewCounts, workspaceAdrCount, drafts } = aggregates;

  const countByAppId = new Map<string, number>();
  let unboundCount = 0;
  for (const row of grouped) {
    if (!row.appId) {
      unboundCount += row.docCount;
      continue;
    }
    countByAppId.set(row.appId, row.docCount);
  }

  const appsSummary = allApps.map((app) => {
    const bound = countByAppId.get(app.id) ?? 0;
    const extra =
      activeView === "all" || activeView === "adrs" ? workspaceAdrCount : 0;
    return { id: app.id, name: app.name, count: bound + extra };
  });

  const systemsWithDocs = appsSummary.filter((row) => row.count > 0).length + (unboundCount > 0 ? 1 : 0);

  return {
    viewCounts,
    apps: appsSummary,
    unboundCount,
    workspaceAdrCount,
    stats: {
      total: viewCounts[activeView],
      drafts,
      systems: systemsWithDocs,
    },
  };
}
