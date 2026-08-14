import { toast } from "vue3-toastify";

export function useReleaseMediaUpload() {
  async function uploadReleaseImage(releaseId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await $fetch<{ data: { path: string; url: string; assetId: string } }>(
        `/api/releases/${releaseId}/uploads`,
        {
          method: "POST",
          body: formData,
        }
      );
      return response.data.path;
    } catch (error: any) {
      const message =
        error?.data?.message || error?.message || "Failed to upload image";
      toast.error(message);
      throw error;
    }
  }

  return { uploadReleaseImage };
}
