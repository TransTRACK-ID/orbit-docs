import { toast } from "vue3-toastify";

const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function useLogoUpload() {
  const isUploading = ref(false);

  function validateLogoFile(file: File): string | null {
    const mime = file.type.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_LOGO_MIME_TYPES.has(mime)) {
      return "Unsupported file type. Use PNG, JPG, GIF, WebP, or SVG.";
    }
    if (file.size > MAX_LOGO_BYTES) {
      return "Logo must be 2 MB or smaller.";
    }
    return null;
  }

  async function uploadLogo(file: File): Promise<string> {
    const validationError = validateLogoFile(file);
    if (validationError) {
      toast.error(validationError);
      throw new Error(validationError);
    }

    const formData = new FormData();
    formData.append("file", file);

    isUploading.value = true;
    try {
      const response = await $fetch<{ data: { path: string; url: string; assetId: string } }>(
        "/api/uploads/logo",
        {
          method: "POST",
          body: formData,
        }
      );
      return response.data.url;
    } catch (error: any) {
      const message =
        error?.data?.message || error?.message || "Failed to upload logo";
      toast.error(message);
      throw error;
    } finally {
      isUploading.value = false;
    }
  }

  return {
    isUploading,
    uploadLogo,
    validateLogoFile,
  };
}
