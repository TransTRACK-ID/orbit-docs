import { toast } from "vue3-toastify";

export interface EmbedNavItem {
  type: "section" | "indent";
  text: string;
  slug?: string;
  active?: boolean;
}

export interface EmbedDocItem {
  id: string;
  appId: string | null;
  versionId: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  navItems: EmbedNavItem[] | null;
  content: string | null;
  status: "draft" | "published" | "archived";
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  app: { id: string; name: string } | null;
  version: { id: string; version: string } | null;
}

export interface EmbedDocDetail extends EmbedDocItem {
  appVersions: Array<{ id: string; version: string; status: string }>;
}

export interface CreateEmbedDocPayload {
  title: string;
  appId?: string | null;
  versionId?: string | null;
  subtitle?: string;
  navItems?: EmbedNavItem[];
  content?: string;
  status?: string;
  author?: string;
}

export const useEmbedDocs = () => {
  const embedDocs = ref<EmbedDocItem[]>([]);
  const currentEmbedDoc = ref<EmbedDocDetail | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const search = ref("");

  async function fetchEmbedDocs(filters?: { appId?: string; status?: string }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: EmbedDocItem[] }>("/api/embed-docs", {
        query: {
          ...(search.value ? { search: search.value } : {}),
          ...(filters?.appId ? { appId: filters.appId } : {}),
          ...(filters?.status ? { status: filters.status } : {}),
        },
      });
      embedDocs.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load embed docs");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchEmbedDoc(id: string) {
    currentEmbedDoc.value = null;
    try {
      const data = await $fetch<{ data: EmbedDocDetail }>(`/api/embed-docs/${id}`);
      currentEmbedDoc.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load embed doc");
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchPublicEmbedDoc(slug: string) {
    try {
      const data = await $fetch<{ data: EmbedDocItem }>(`/api/embed-docs/public/${slug}`);
      return data.data;
    } catch (e: any) {
      toast.error("Failed to load documentation");
      console.error(e);
      throw e;
    }
  }

  async function createEmbedDoc(payload: CreateEmbedDocPayload) {
    try {
      const data = await $fetch<{ data: EmbedDocItem }>("/api/embed-docs", {
        method: "POST",
        body: payload,
      });
      embedDocs.value.unshift(data.data);
      toast.success(`Embed doc "${data.data.title}" created`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create embed doc";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function updateEmbedDoc(id: string, payload: CreateEmbedDocPayload) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: EmbedDocDetail }>(`/api/embed-docs/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = embedDocs.value.findIndex((d) => d.id === id);
      if (idx !== -1) {
        embedDocs.value[idx] = { ...embedDocs.value[idx], ...data.data };
      }
      if (currentEmbedDoc.value && currentEmbedDoc.value.id === id) {
        currentEmbedDoc.value = { ...currentEmbedDoc.value, ...data.data };
      }
      toast.success("Embed doc saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update embed doc";
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

  async function deleteEmbedDoc(id: string) {
    try {
      await $fetch(`/api/embed-docs/${id}`, {
        method: "DELETE",
      });
      embedDocs.value = embedDocs.value.filter((d) => d.id !== id);
      if (currentEmbedDoc.value && currentEmbedDoc.value.id === id) {
        currentEmbedDoc.value = null;
      }
      toast.success("Embed doc deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete embed doc";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  return {
    embedDocs,
    currentEmbedDoc,
    isLoading,
    isSaving,
    search,
    fetchEmbedDocs,
    fetchEmbedDoc,
    fetchPublicEmbedDoc,
    createEmbedDoc,
    updateEmbedDoc,
    deleteEmbedDoc,
  };
};
