import { toast } from "vue3-toastify";

export interface PublishedDocItem {
  id: string;
  appId: string | null;
  title: string;
  content: string | null;
  status: "published";
  versionId: string | null;
  tags: string[] | null;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  app: { id: string; name: string } | null;
  version: { id: string; version: string } | null;
}

export interface PublishedDocDetail extends PublishedDocItem {
  appVersions: Array<{ id: string; version: string; status: string }>;
}

export const usePublishedDocs = () => {
  const docs = ref<PublishedDocItem[]>([]);
  const currentDoc = ref<PublishedDocDetail | null>(null);
  const isLoading = ref(false);
  const search = ref("");

  async function fetchPublishedDocs(filters?: { appId?: string }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: PublishedDocItem[] }>("/api/published-docs", {
        query: {
          ...(search.value ? { search: search.value } : {}),
          ...(filters?.appId ? { appId: filters.appId } : {}),
        },
      });
      docs.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load published docs");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPublishedDoc(id: string) {
    currentDoc.value = null;
    try {
      const data = await $fetch<{ data: PublishedDocDetail }>(`/api/published-docs/${id}`);
      currentDoc.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else if (e?.statusCode === 404) {
        toast.error("Doc not found");
      } else if (e?.statusCode === 403) {
        toast.error("This document is not published");
      } else {
        toast.error("Failed to load doc");
      }
      console.error(e);
      throw e;
    }
  }

  return {
    docs,
    currentDoc,
    isLoading,
    search,
    fetchPublishedDocs,
    fetchPublishedDoc,
  };
};
