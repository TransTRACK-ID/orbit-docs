import { toast } from "vue3-toastify";
import type { NavConfig, NormalizedOpenApi } from "~/server/database/schema";

export interface DocSitePage {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  sortOrder: number;
  frontmatter?: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface DocSiteItem {
  id: string;
  appId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  navConfig: NavConfig | null;
  openapiSpec?: string | null;
  openapiFormat?: "json" | "yaml" | null;
  openapiNormalized?: NormalizedOpenApi | null;
  createdAt: string | null;
  updatedAt: string | null;
  app: { id: string; name: string } | null;
}

export interface DocSiteDetail extends DocSiteItem {
  pages: DocSitePage[];
}

export interface GenerateOpenApiResult {
  format: "json" | "yaml";
  operationsCount: number;
  tags: string[];
  navConfig: NavConfig;
}

export interface CreateDocSitePayload {
  name: string;
  slug?: string;
  description?: string;
  appId?: string | null;
  status?: string;
  navConfig?: NavConfig;
}

export interface UpdateDocSitePayload extends Partial<CreateDocSitePayload> {}

export const useDocSites = () => {
  const docSites = ref<DocSiteItem[]>([]);
  const currentSite = ref<DocSiteDetail | null>(null);
  const sitePages = ref<DocSitePage[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);

  async function fetchDocSites(filters?: { appId?: string }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: DocSiteItem[] }>("/api/doc-sites", {
        query: filters?.appId ? { appId: filters.appId } : undefined,
      });
      docSites.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load doc sites");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchDocSite(id: string) {
    currentSite.value = null;
    try {
      const data = await $fetch<{ data: DocSiteDetail }>(`/api/doc-sites/${id}`);
      currentSite.value = data.data;
      sitePages.value = data.data.pages || [];
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load doc site");
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchSitePages(id: string) {
    try {
      const data = await $fetch<{ data: DocSitePage[] }>(`/api/doc-sites/${id}/pages`);
      sitePages.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load site pages");
      }
      console.error(e);
    }
  }

  async function createDocSite(payload: CreateDocSitePayload) {
    try {
      const data = await $fetch<{ data: DocSiteItem }>("/api/doc-sites", {
        method: "POST",
        body: payload,
      });
      docSites.value.unshift(data.data);
      toast.success(`Doc site "${data.data.name}" created`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create doc site";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function updateDocSite(id: string, payload: UpdateDocSitePayload) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: DocSiteItem }>(`/api/doc-sites/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = docSites.value.findIndex((s) => s.id === id);
      if (idx !== -1) {
        docSites.value[idx] = { ...docSites.value[idx], ...data.data };
      }
      if (currentSite.value && currentSite.value.id === id) {
        currentSite.value = { ...currentSite.value, ...data.data };
      }
      toast.success("Doc site saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update doc site";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function deleteDocSite(id: string) {
    try {
      await $fetch(`/api/doc-sites/${id}`, { method: "DELETE" });
      docSites.value = docSites.value.filter((s) => s.id !== id);
      if (currentSite.value && currentSite.value.id === id) {
        currentSite.value = null;
      }
      toast.success("Doc site deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete doc site";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function generateOpenApi(id: string, spec: string, format?: "json" | "yaml") {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: GenerateOpenApiResult }>(`/api/doc-sites/${id}/openapi`, {
        method: "POST",
        body: { spec, format },
      });
      if (currentSite.value && currentSite.value.id === id) {
        currentSite.value = {
          ...currentSite.value,
          navConfig: data.data.navConfig,
          openapiSpec: spec,
          openapiFormat: data.data.format,
        };
      }
      toast.success(`Generated ${data.data.operationsCount} API operations`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to generate OpenAPI site";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    docSites,
    currentSite,
    sitePages,
    isLoading,
    isSaving,
    fetchDocSites,
    fetchDocSite,
    fetchSitePages,
    createDocSite,
    updateDocSite,
    deleteDocSite,
    generateOpenApi,
  };
};
