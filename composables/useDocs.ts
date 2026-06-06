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
  source: "manual" | "generated";
  docType: string | null;
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

export interface DocVersion {
  id: string;
  docId: string;
  version: string;
  content: string | null;
  title: string | null;
  actor: string | null;
  createdAt: string | null;
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
  source?: string;
  docType?: string;
}

export const useDocs = () => {
  const docs = ref<DocItem[]>([]);
  const currentDoc = ref<DocDetail | null>(null);
  const docVersions = ref<DocVersion[]>([]);
  const isLoading = ref(true);
  const isSaving = ref(false);
  const isLoadingVersions = ref(false);
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
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load docs");
      }
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
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load doc");
      }
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
      const msg = e?.data?.message || e?.message || "Failed to create doc";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
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
      const msg = e?.data?.message || e?.message || "Failed to update doc";
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
      const msg = e?.data?.message || e?.message || "Failed to publish doc";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
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
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete doc";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function fetchDocVersions(id: string) {
    isLoadingVersions.value = true;
    try {
      const data = await $fetch<{ data: DocVersion[] }>(`/api/docs/${id}/versions`);
      docVersions.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load doc versions");
      }
      console.error(e);
      throw e;
    } finally {
      isLoadingVersions.value = false;
    }
  }

  async function restoreDocVersion(id: string, versionId: string) {
    try {
      const data = await $fetch<{ data: DocItem }>(`/api/docs/${id}/versions/${versionId}`, {
        method: "POST",
      });
      if (currentDoc.value && currentDoc.value.id === id) {
        currentDoc.value = { ...currentDoc.value, ...data.data };
      }
      toast.success("Version restored");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to restore version";
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
    docs,
    currentDoc,
    docVersions,
    isLoading,
    isSaving,
    isLoadingVersions,
    search,
    fetchDocs,
    fetchDoc,
    createDoc,
    updateDoc,
    publishDoc,
    deleteDoc,
    fetchDocVersions,
    restoreDocVersion,
  };
};
