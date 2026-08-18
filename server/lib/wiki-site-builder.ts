import { getDb } from "~/server/database";
import { docSites, docs, activityLogs } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { isValidSiteSlug, slugify } from "~/server/lib/nav-config";
import type { WikiOutlinePagePlan, WikiSitePlan } from "~/server/lib/doc-prompts";
import { buildNavConfigFromPlan } from "~/utils/wiki-nav";

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

export async function createOrUpdateWikiSite(
  appId: string,
  plan: WikiSitePlan,
  pages: WikiPageContent[],
  actor: string,
): Promise<WikiSiteBuildResult> {
  const db = getDb();
  const navConfig = buildNavConfigFromPlan(plan);
  const siteSlug = isValidSiteSlug(plan.siteSlug) ? plan.siteSlug : slugify(plan.siteName);

  let site = await findWikiSiteForApp(appId, siteSlug);

  if (site) {
    const updated = await db
      .update(docSites)
      .set({
        name: plan.siteName,
        description: `Generated wiki for ${plan.siteName}`,
        navConfig,
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
        navConfig,
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

  const existingPages = await db
    .select({ id: docs.id, slug: docs.slug })
    .from(docs)
    .where(eq(docs.siteId, site.id));

  const existingBySlug = new Map(
    existingPages.filter((p) => p.slug).map((p) => [p.slug!, p.id]),
  );

  const pageIds: string[] = [];

  for (const page of pages) {
    const existingId = existingBySlug.get(page.slug);
    if (existingId) {
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
        .where(eq(docs.id, existingId));
      pageIds.push(existingId);
    } else {
      const inserted = await db
        .insert(docs)
        .values({
          appId,
          siteId: site.id,
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
      pageIds.push(inserted.id);
    }
  }

  await db.insert(activityLogs).values({
    appId,
    appName: plan.siteName,
    action: `Wiki site updated (${pages.length} pages)`,
    actor,
  });

  return {
    siteId: site.id,
    siteSlug: site.slug,
    pageIds,
  };
}

export function wikiPageSortOrder(slug: string, index: number): number {
  const match = slug.match(/^(\d+)-/);
  if (match) return Number.parseInt(match[1], 10) * 10;
  return (index + 1) * 10;
}

export function planPageTitle(page: WikiOutlinePagePlan): string {
  return page.title.trim() || page.slug;
}
