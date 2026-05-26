import { toast } from "vue3-toastify";
import type { CollectionDocsResponse } from "~/types/apiDocs";

export const useApiDocs = () => {
  const data = ref<CollectionDocsResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string>("");

  async function fetchApiDocs(slug: string) {
    isLoading.value = true;
    error.value = "";
    data.value = null;

    try {
      const result = await $fetch<CollectionDocsResponse>(`/api/api-docs/${slug}`);
      data.value = result;
      return result;
    } catch (e: any) {
      const status = e?.statusCode;
      const message = e?.message || "Failed to load documentation";

      if (status === 404) {
        error.value = "API documentation not found";
      } else if (status === 403) {
        error.value = "This documentation is not publicly available";
      } else if (status === 503) {
        error.value = "Postrack API is not configured";
      } else {
        error.value = "Unable to load documentation. Please try again later.";
      }

      console.error("[useApiDocs] fetch error:", status, message);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    data,
    isLoading,
    error,
    fetchApiDocs,
  };
};
