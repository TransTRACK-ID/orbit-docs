export interface PublicWorkspace {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

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

export function usePublicSupport() {
  async function fetchWorkspace(): Promise<PublicWorkspace> {
    const res = await $fetch<{ data: PublicWorkspace }>("/api/public/workspace");
    return res.data;
  }

  async function fetchProducts(search = ""): Promise<PublicProduct[]> {
    const res = await $fetch<{ data: PublicProduct[] }>("/api/public/products", {
      query: search ? { search } : undefined,
    });
    return res.data;
  }

  async function fetchProduct(slug: string): Promise<PublicProduct> {
    const res = await $fetch<{ data: PublicProduct }>(`/api/public/products/${slug}`);
    return res.data;
  }

  return {
    fetchWorkspace,
    fetchProducts,
    fetchProduct,
  };
}
