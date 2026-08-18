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

  const siteProducts: PublicProduct[] = [];

  for (const site of siteRows) {
    const isWikiSite = wikiOnlySiteIds.has(site.id);
    const publishedPages = docRows.filter(
      (doc) => doc.siteId === site.id && doc.status === "published" && doc.slug,
    );

    const hasPublicSite = !isWikiSite && site.status === "published";
    if (!hasPublicSite && publishedPages.length === 0) continue;

    const homePath = isWikiSite ? `/wiki/${site.slug}` : `/s/${site.slug}`;
    const pages: PublicProductPage[] = publishedPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug!,
      path: `${homePath}/${page.slug}`,
    }));

    const docSiteEntry: PublicProductDocSite = {
      id: site.id,
      name: site.name,
      slug: site.slug,
      description: site.description,
      pageCount: publishedPages.length,
      homePath,
      isWikiSite,
    };

    siteProducts.push({
      id: site.id,
      name: site.name,
      slug: site.slug,
      description: site.description,
      status: site.status,
      logoUrl: site.logoUrl,
      isWikiSite,
      homePath,
      kind: "site",
      docSites: [docSiteEntry],
      pages,
      releaseCount: await countPublishedReleases(db, site.appId),
      publishedDocCount: publishedPages.length,
    });
  }

  const coveredAppIds = new Set(
    siteRows
      .map((site) => site.appId)
      .filter((appId): appId is string => !!appId),
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

  const orphanApps = assignUniqueSlugs(appRows.filter((app) => !coveredAppIds.has(app.id)));

  const appProducts: PublicProduct[] = await Promise.all(
    orphanApps.map(async (app) => {
      const publishedDocCountRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(docs)
        .where(and(eq(docs.appId, app.id), eq(docs.status, "published")));

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
        docSites: [],
        pages: [],
        releaseCount: await countPublishedReleases(db, app.id),
        publishedDocCount: publishedDocCountRows[0]?.count ?? 0,
      };
    }),
  );

  const products = [...siteProducts, ...appProducts].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (!search.trim()) return products;

  const q = search.trim().toLowerCase();
  return products.filter((product) => {
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
  return (
    products.find((product) => product.slug === slug || product.id === slug) ?? null
  );
}
