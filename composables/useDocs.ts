import { toast } from "vue3-toastify";

export interface DocItem {
  id: string;
  appId: string | null;
  title: string;
  content: string | null;
  status: "draft" | "in_review" | "published" | "archived";
  versionId: string | null;
  tags: string[] | null;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  app: { id: string; name: string } | null;
  version: { id: string; version: string } | null;
}

export interface DocVersionOption {
  id: string;
  version: string;
  status: string;
}

export interface DocDetail extends DocItem {
  appVersions: DocVersionOption[];
}

export interface CreateDocPayload {
  title: string;
  appId?: string | null;
  content?: string;
  status?: string;
  versionId?: string | null;
  tags?: string[];
  author?: string;
}

export const useDocs = () => {
  const docs = ref<DocItem[]>([]);
  const currentDoc = ref<DocDetail | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const search = ref("");

  async function fetchDocs(filters?: { appId?: string; status?: string }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: DocItem[] }>("/api/docs", {
        query: {
          ...(search.value ? { search: search.value } : {}),
          ...(filters?.appId ? { appId: filters.appId } : {}),
          ...(filters?.status ? { status: filters.status } : {}),
        },
      });
      docs.value = data.data;
    } catch (e) {
      toast.error("Failed to load docs");
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchDoc(id: string) {
    currentDoc.value = null;
    try {
      const data = await $fetch<{ data: DocDetail }>(`/api/docs/${id}`);
      currentDoc.value = data.data;
      return data.data;
    } catch (e) {
      toast.error("Failed to load doc");
      console.error(e);
      throw e;
    }
  }

  async function createDoc(payload: CreateDocPayload) {
    try {
      const data = await $fetch<{ data: DocItem }>("/api/docs", {
        method: "POST",
        body: payload,
      });
      docs.value.unshift(data.data);
      toast.success(`Doc "${data.data.title}" created`);
      return data.data;
    } catch (e: any) {
      const msg = e?.message || "Failed to create doc";
      toast.error(msg);
      throw e;
    }
  }

  async function updateDoc(id: string, payload: CreateDocPayload) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: DocDetail }>(`/api/docs/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = docs.value.findIndex((d) => d.id === id);
      if (idx !== -1) {
        docs.value[idx] = { ...docs.value[idx], ...data.data };
      }
      if (currentDoc.value && currentDoc.value.id === id) {
        currentDoc.value = { ...currentDoc.value, ...data.data };
      }
      toast.success("Draft saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.message || "Failed to update doc";
      toast.error(msg);
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function publishDoc(id: string) {
    try {
      const data = await $fetch<{ data: DocDetail }>(`/api/docs/${id}/publish`, {
        method: "POST",
      });
      const idx = docs.value.findIndex((d) => d.id === id);
      if (idx !== -1) {
        docs.value[idx] = { ...docs.value[idx], ...data.data };
      }
      if (currentDoc.value && currentDoc.value.id === id) {
        currentDoc.value = { ...currentDoc.value, ...data.data, status: "published" };
      }
      toast.success(`Published: ${data.data.title}`);
      return data.data;
    } catch (e: any) {
      const msg = e?.message || "Failed to publish doc";
      toast.error(msg);
      throw e;
    }
  }

  async function deleteDoc(id: string) {
    try {
      await $fetch(`/api/docs/${id}`, {
        method: "DELETE",
      });
      docs.value = docs.value.filter((d) => d.id !== id);
      if (currentDoc.value && currentDoc.value.id === id) {
        currentDoc.value = null;
      }
      toast.success("Doc deleted");
    } catch (e) {
      toast.error("Failed to delete doc");
      throw e;
    }
  }

  return {
    docs,
    currentDoc,
    isLoading,
    isSaving,
    search,
    fetchDocs,
    fetchDoc,
    createDoc,
    updateDoc,
    publishDoc,
    deleteDoc,
  };
};
