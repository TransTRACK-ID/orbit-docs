import { and, eq, ne, sql } from "drizzle-orm";
import { apps, docSites, docs, releases } from "~/server/database/schema";
import { slugify } from "~/server/utils/slug";
import { deriveWikiOnlySiteIds } from "~/utils/wiki-content";

export interface PublicProductPage {
  id: string;
  title: string;
  slug: string;
  path: string;
}

export interface PublicProductDocSite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pageCount: number;
  homePath: string;
  isWikiSite: boolean;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  logoUrl: string | null;
  isWikiSite: boolean;
  homePath: string;
  kind: "site" | "app";
  docSites: PublicProductDocSite[];
  pages: PublicProductPage[];
  releaseCount: number;
  publishedDocCount: number;
}

/** Apps visible on the public help center root (active = published in /apps). */
export function isPublicHelpApp(status: string): boolean {
  return status === "active";
}

/** Whether a doc site should appear under an app's help hub. */
export function shouldIncludeDocSiteInCatalog(
  isWikiSite: boolean,
  siteStatus: string,
  publishedPageCount: number,
): boolean {
  const hasPublicSite = !isWikiSite && siteStatus === "published";
  return hasPublicSite || publishedPageCount > 0;
}

function assignUniqueSlugs<T extends { id: string; name: string }>(
  items: T[],
): Array<T & { slug: string }> {
  const used = new Set<string>();
  return items.map((item) => {
    let base = slugify(item.name) || item.id.slice(0, 8);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return { ...item, slug: candidate };
  });
}

async function countPublishedReleases(
  db: ReturnType<typeof import("~/server/database").getDb>,
  appId: string | null,
): Promise<number> {
  if (!appId) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(releases)
    .where(and(eq(releases.appId, appId), eq(releases.published, true)));
  return rows[0]?.count ?? 0;
}

type SiteRow = {
  id: string;
  appId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  appName: string | null;
  logoUrl: string | null;
};

type DocRow = {
  id: string;
  siteId: string | null;
  appId: string | null;
  title: string;
  slug: string | null;
  status: string;
  docType: string | null;
};

function buildDocSitesForApp(
  appId: string,
  siteRows: SiteRow[],
  docRows: DocRow[],
  wikiOnlySiteIds: Set<string>,
): { docSites: PublicProductDocSite[]; pages: PublicProductPage[] } {
  const docSitesForApp: PublicProductDocSite[] = [];
  const pages: PublicProductPage[] = [];

  for (const site of siteRows.filter((row) => row.appId === appId)) {
    const isWikiSite = wikiOnlySiteIds.has(site.id);
    const publishedPages = docRows.filter(
      (doc) => doc.siteId === site.id && doc.status === "published" && doc.slug,
    );

    if (!shouldIncludeDocSiteInCatalog(isWikiSite, site.status, publishedPages.length)) {
      continue;
    }

    const homePath = isWikiSite ? `/wiki/${site.slug}` : `/s/${site.slug}`;
    docSitesForApp.push({
      id: site.id,
      name: site.name,
      slug: site.slug,
      description: site.description,
      pageCount: publishedPages.length,
      homePath,
      isWikiSite,
    });

    for (const page of publishedPages) {
      pages.push({
        id: page.id,
        title: page.title,
        slug: page.slug!,
        path: `${homePath}/${page.slug}`,
      });
    }
  }

  docSitesForApp.sort((a, b) => a.name.localeCompare(b.name));
  pages.sort((a, b) => a.title.localeCompare(b.title));

  return { docSites: docSitesForApp, pages };
}

export async function listPublicProducts(
  db: ReturnType<typeof import("~/server/database").getDb>,
  search = "",
): Promise<PublicProduct[]> {
  const siteRows = await db
    .select({
      id: docSites.id,
      appId: docSites.appId,
      name: docSites.name,
      slug: docSites.slug,
      description: docSites.description,
      status: docSites.status,
      appName: apps.name,
      logoUrl: apps.logoUrl,
    })
    .from(docSites)
    .leftJoin(apps, eq(docSites.appId, apps.id))
    .where(ne(docSites.status, "archived"))
    .orderBy(docSites.name);

  const docRows = await db
    .select({
      id: docs.id,
      siteId: docs.siteId,
      appId: docs.appId,
      title: docs.title,
      slug: docs.slug,
      status: docs.status,
      docType: docs.docType,
    })
    .from(docs)
    .where(ne(docs.status, "archived"));

  const wikiOnlySiteIds = deriveWikiOnlySiteIds(
    docRows.map((row) => ({ siteId: row.siteId, docType: row.docType })),
  );

  const appRows = await db
    .select({
      id: apps.id,
      name: apps.name,
      description: apps.description,
      status: apps.status,
      logoUrl: apps.logoUrl,
    })
    .from(apps)
    .orderBy(apps.name);

  const publicApps = assignUniqueSlugs(
    appRows.filter((app) => isPublicHelpApp(app.status)),
  );

  const products: PublicProduct[] = await Promise.all(
    publicApps.map(async (app) => {
      const { docSites: docSitesForApp, pages } = buildDocSitesForApp(
        app.id,
        siteRows,
        docRows,
        wikiOnlySiteIds,
      );

      const standalonePublishedDocs = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(docs)
        .where(
          and(
            eq(docs.appId, app.id),
            eq(docs.status, "published"),
            sql`${docs.siteId} IS NULL`,
          ),
        );

      const sitePageCount = pages.length;
      const standaloneCount = standalonePublishedDocs[0]?.count ?? 0;

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        status: app.status,
        logoUrl: app.logoUrl,
        isWikiSite: false,
        homePath: `/support/${app.slug}`,
        kind: "app" as const,
        docSites: docSitesForApp,
        pages,
        releaseCount: await countPublishedReleases(db, app.id),
        publishedDocCount: sitePageCount + standaloneCount,
      };
    }),
  );

  const sorted = products.sort((a, b) => a.name.localeCompare(b.name));

  if (!search.trim()) return sorted;

  const q = search.trim().toLowerCase();
  return sorted.filter((product) => {
    const haystack = [
      product.name,
      product.description,
      ...product.pages.map((page) => page.title),
      ...product.docSites.map((site) => [site.name, site.description].join(" ")),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getPublicProductBySlug(
  db: ReturnType<typeof import("~/server/database").getDb>,
  slug: string,
): Promise<PublicProduct | null> {
  const products = await listPublicProducts(db);
  const byApp = products.find((product) => product.slug === slug || product.id === slug);
  if (byApp) return byApp;

  // Legacy: doc-site slugs that used to appear as top-level products.
  return (
    products.find((product) => product.docSites.some((site) => site.slug === slug)) ?? null
  );
}
