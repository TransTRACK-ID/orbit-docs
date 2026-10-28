import { getDb } from "~/server/database";
import { docSites, docs, activityLogs } from "~/server/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { isValidSiteSlug, slugify } from "~/server/lib/nav-config";
import type { WikiOutlinePagePlan, WikiSitePlan } from "~/server/lib/doc-prompts";
import { buildNavConfigFromPlan } from "~/utils/wiki-nav";
import { onDocContentSaved } from "~/server/lib/doc-embedding-hooks";

export interface WikiPageContent {
  slug: string;
  title: string;
  content: string;
  sortOrder: number;
}

export interface WikiSiteBuildResult {
  siteId: string;
  siteSlug: string;
  pageIds: string[];
}

export interface ExistingWikiPageRow {
  id: string;
  slug: string | null;
  docType: string | null;
  source: string;
  status: string;
}

/**
 * Ids of generated wiki pages whose slug is absent from the new plan.
 * Manual pages, non-wiki docs, archived rows, and slug-less rows are kept:
 * only a slugged generated wiki page can be proven to be an orphan.
 */
export function staleWikiPageIds(
  existingPages: ExistingWikiPageRow[],
  keepSlugs: ReadonlySet<string>,
): string[] {
  return existingPages
    .filter(
      (p) =>
        p.docType === "wiki" &&
        p.source === "generated" &&
        p.status !== "archived" &&
        !!p.slug &&
        !keepSlugs.has(p.slug),
    )
    .map((p) => p.id);
}

async function findWikiSiteForApp(appId: string, siteSlug: string) {
  const db = getDb();
  const bySlug = await db
    .select()
    .from(docSites)
    .where(eq(docSites.slug, siteSlug))
    .limit(1)
    .then((r) => r[0] || null);

  if (bySlug && bySlug.appId === appId) return bySlug;

  const byApp = await db
    .select()
    .from(docSites)
    .where(and(eq(docSites.appId, appId), eq(docSites.slug, siteSlug)))
    .limit(1)
    .then((r) => r[0] || null);

  return byApp;
}

export async function ensureWikiSite(
  appId: string,
  plan: WikiSitePlan,
  actor: string,
): Promise<WikiSiteBuildResult> {
  const db = getDb();
  const siteSlug = isValidSiteSlug(plan.siteSlug) ? plan.siteSlug : slugify(plan.siteName);

  let site = await findWikiSiteForApp(appId, siteSlug);

  if (site) {
    const updated = await db
      .update(docSites)
      .set({
        name: plan.siteName,
        description: `Generated wiki for ${plan.siteName}`,
        updatedAt: new Date(),
      })
      .where(eq(docSites.id, site.id))
      .returning()
      .then((r) => r[0]);
    site = updated;
  } else {
    const created = await db
      .insert(docSites)
      .values({
        name: plan.siteName,
        slug: siteSlug,
        description: `Generated wiki for ${plan.siteName}`,
        appId,
        status: "draft",
        navConfig: buildNavConfigFromPlan(plan),
      })
      .returning()
      .then((r) => r[0]);
    site = created;

    await db.insert(activityLogs).values({
      appId,
      appName: plan.siteName,
      action: "Wiki site created",
      actor,
    });
  }

  return {
    siteId: site.id,
    siteSlug: site.slug,
    pageIds: [],
  };
}

export async function upsertWikiPage(
  siteId: string,
  appId: string,
  page: WikiPageContent,
  actor: string,
): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: docs.id })
    .from(docs)
    .where(and(eq(docs.siteId, siteId), eq(docs.slug, page.slug)))
    .limit(1)
    .then((r) => r[0] || null);

  if (existing) {
    await db
      .update(docs)
      .set({
        title: page.title,
        content: page.content,
        sortOrder: page.sortOrder,
        docType: "wiki",
        source: "generated",
        updatedAt: new Date(),
      })
      .where(eq(docs.id, existing.id));
    onDocContentSaved({ id: existing.id, docType: "wiki", content: page.content });
    return existing.id;
  }

  const inserted = await db
    .insert(docs)
    .values({
      appId,
      siteId,
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: "draft",
      source: "generated",
      docType: "wiki",
      sortOrder: page.sortOrder,
      author: actor,
    })
    .returning({ id: docs.id })
    .then((r) => r[0]);
  onDocContentSaved({ id: inserted.id, docType: "wiki", content: page.content });
  return inserted.id;
}

export async function finalizeWikiSite(
  siteId: string,
  appId: string,
  plan: WikiSitePlan,
  succeeded: WikiOutlinePagePlan[],
  actor: string,
  opts: { archiveStale: boolean },
): Promise<{ archivedCount: number }> {
  const db = getDb();
  const navConfig = buildNavConfigFromPlan({ pages: succeeded });

  await db
    .update(docSites)
    .set({
      name: plan.siteName,
      description: `Generated wiki for ${plan.siteName}`,
      navConfig,
      updatedAt: new Date(),
    })
    .where(eq(docSites.id, siteId));

  let archivedCount = 0;
  if (opts.archiveStale) {
    const existingPages = await db
      .select({
        id: docs.id,
        slug: docs.slug,
        docType: docs.docType,
        source: docs.source,
        status: docs.status,
      })
      .from(docs)
      .where(eq(docs.siteId, siteId));

    const staleIds = staleWikiPageIds(
      existingPages,
      new Set(plan.pages.map((p) => p.slug)),
    );
    if (staleIds.length > 0) {
      await db
        .update(docs)
        .set({ status: "archived", updatedAt: new Date() })
        .where(inArray(docs.id, staleIds));
    }
    archivedCount = staleIds.length;
  }

  await db.insert(activityLogs).values({
    appId,
    appName: plan.siteName,
    action:
      archivedCount === 0
        ? `Wiki site updated (${succeeded.length} pages)`
        : `Wiki site updated (${succeeded.length} pages, ${archivedCount} stale archived)`,
    actor,
  });

  return { archivedCount };
}


export function wikiPageSortOrder(slug: string, index: number): number {
  const match = slug.match(/^(\d+)-/);
  if (match) return Number.parseInt(match[1], 10) * 10;
  return (index + 1) * 10;
}

export function planPageTitle(page: WikiOutlinePagePlan): string {
  return page.title.trim() || page.slug;
}
