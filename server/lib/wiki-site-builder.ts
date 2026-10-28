import { getDb } from "~/server/database";
import { docSites, docs, activityLogs } from "~/server/database/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { isValidSiteSlug, slugify } from "~/server/lib/nav-config";
import type { WikiOutlinePagePlan, WikiSitePlan } from "~/server/lib/doc-prompts";
import { buildNavConfigFromPlan } from "~/utils/wiki-nav";
import { onDocContentSaved } from "~/server/lib/doc-embedding-hooks";
import { createDocVersionSnapshot } from "~/server/lib/doc-version-snapshot";

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
  created: boolean;
}

export interface ExistingWikiPageRow {
  id: string;
  slug: string | null;
  docType: string | null;
  source: string;
  status: string;
}

export function pickCanonicalWikiSite<
  T extends { id: string; createdAt: Date | null; updatedAt: Date | null },
>(sites: T[]): T | null {
  if (sites.length === 0) return null;
  const time = (d: Date | null): number => (d ? d.getTime() : 0);
  return sites.reduce((best, site) => {
    const bestKey: [number, number, string] = [
      time(best.updatedAt ?? best.createdAt),
      time(best.createdAt),
      best.id,
    ];
    const siteKey: [number, number, string] = [
      time(site.updatedAt ?? site.createdAt),
      time(site.createdAt),
      site.id,
    ];
    if (siteKey[0] !== bestKey[0]) return siteKey[0] > bestKey[0] ? site : best;
    if (siteKey[1] !== bestKey[1]) return siteKey[1] > bestKey[1] ? site : best;
    return siteKey[2] > bestKey[2] ? site : best;
  });
}

export function firstFreeWikiSlug(base: string, taken: ReadonlySet<string>): string | null {
  const candidates = [
    base,
    `${base}-wiki`,
    ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`),
  ];
  return candidates.find((c) => !taken.has(c)) ?? null;
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

async function findWikiSiteForApp(appId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(docSites)
    .where(
      and(eq(docSites.appId, appId), eq(docSites.kind, "wiki"), ne(docSites.status, "archived")),
    );
  return pickCanonicalWikiSite(rows);
}

export async function ensureWikiSite(
  appId: string,
  plan: WikiSitePlan,
  actor: string,
): Promise<WikiSiteBuildResult> {
  const db = getDb();
  const preferredSlug =
    (isValidSiteSlug(plan.siteSlug) ? plan.siteSlug : slugify(plan.siteName)) || "wiki";

  const existing = await findWikiSiteForApp(appId);
  if (existing) {
    const updated = await db
      .update(docSites)
      .set({
        name: plan.siteName,
        description: `Generated wiki for ${plan.siteName}`,
        updatedAt: new Date(),
      })
      .where(eq(docSites.id, existing.id))
      .returning()
      .then((r) => r[0]);
    return { siteId: updated.id, siteSlug: updated.slug, pageIds: [], created: false };
  }

  const candidates = [
    preferredSlug,
    `${preferredSlug}-wiki`,
    ...Array.from({ length: 8 }, (_, i) => `${preferredSlug}-${i + 2}`),
  ];
  const takenRows = await db
    .select({ slug: docSites.slug })
    .from(docSites)
    .where(inArray(docSites.slug, candidates));
  const slug = firstFreeWikiSlug(preferredSlug, new Set(takenRows.map((r) => r.slug)));
  if (!slug) {
    throw new Error(`Could not allocate a wiki site slug from "${preferredSlug}"`);
  }

  try {
    const created = await db
      .insert(docSites)
      .values({
        name: plan.siteName,
        slug,
        description: `Generated wiki for ${plan.siteName}`,
        appId,
        status: "draft",
        kind: "wiki",
        navConfig: buildNavConfigFromPlan(plan),
      })
      .returning()
      .then((r) => r[0]);
    return { siteId: created.id, siteSlug: created.slug, pageIds: [], created: true };
  } catch (err: unknown) {
    const winner = await findWikiSiteForApp(appId);
    if (winner) {
      return { siteId: winner.id, siteSlug: winner.slug, pageIds: [], created: false };
    }
    throw err;
  }
}

export async function upsertWikiPage(
  siteId: string,
  appId: string,
  page: WikiPageContent,
  actor: string,
  opts?: { snapshot?: boolean },
): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: docs.id, title: docs.title, content: docs.content })
    .from(docs)
    .where(and(eq(docs.siteId, siteId), eq(docs.slug, page.slug)))
    .limit(1)
    .then((r) => r[0] || null);

  if (existing) {
    if (
      opts?.snapshot !== false &&
      (existing.title !== page.title || (existing.content || "") !== page.content)
    ) {
      await createDocVersionSnapshot(
        db,
        existing.id,
        { title: existing.title, content: existing.content },
        actor,
        "save",
      );
    }
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
  if (opts?.snapshot !== false) {
    await createDocVersionSnapshot(
      db,
      inserted.id,
      { title: page.title, content: page.content },
      actor,
      "save",
    );
  }
  onDocContentSaved({ id: inserted.id, docType: "wiki", content: page.content });
  return inserted.id;
}

export async function finalizeWikiSite(
  siteId: string,
  appId: string,
  plan: WikiSitePlan,
  succeeded: WikiOutlinePagePlan[],
  actor: string,
  opts: { archiveStale: boolean; created: boolean },
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

  const verb = opts.created ? "created" : "updated";
  await db.insert(activityLogs).values({
    appId,
    appName: plan.siteName,
    action:
      archivedCount === 0
        ? `Wiki site ${verb} (${succeeded.length} pages)`
        : `Wiki site ${verb} (${succeeded.length} pages, ${archivedCount} stale archived)`,
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
