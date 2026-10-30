import { readFileAsDataUrl } from "~/composables/useEditorJsConverter";

export type DocAssetKind = "video" | "pdf";

export interface DocAsset {
  id: string;
  docId: string;
  kind: DocAssetKind;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  title: string;
  status: "pending" | "ready";
  shareEnabled: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  createdAt: string | null;
  url: string;
}

export const DOC_ASSET_ACCEPT = {
  pdf: "application/pdf",
  video: "video/mp4,video/webm,video/quicktime",
} as const;

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { data?: { message?: string }; message?: string };
  return err?.data?.message || err?.message || fallback;
}

/** PUT straight to the presigned S3 URL; XHR because fetch has no upload progress. */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload to storage failed (HTTP ${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error("Upload to storage failed. Check the bucket CORS policy allows PUT from this origin."));
    xhr.send(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function publicPdfShareUrl(token: string): string {
  const origin = import.meta.client ? window.location.origin : "";
  return `${origin}/share/pdf/${token}`;
}

export function useDocAssets(docId: Ref<string>) {
  const assets = ref<DocAsset[]>([]);
  const isLoading = ref(false);

  async function fetchAssets(): Promise<void> {
    if (!docId.value) return;
    isLoading.value = true;
    try {
      const res = await $fetch<{ data: DocAsset[] }>(`/api/docs/${docId.value}/assets`);
      assets.value = res.data;
    } catch {
      assets.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function uploadAsset(file: File, onProgress?: (fraction: number) => void): Promise<DocAsset> {
    const contentType = file.type || "application/octet-stream";
    let assetId = "";
    try {
      const reserved = await $fetch<{
        data: { assetId: string; uploadUrl: string; headers: Record<string, string> };
      }>(`/api/docs/${docId.value}/assets/upload-url`, {
        method: "POST",
        body: { fileName: file.name, contentType, size: file.size },
      });
      assetId = reserved.data.assetId;
      await putWithProgress(reserved.data.uploadUrl, file, reserved.data.headers, onProgress);
      const completed = await $fetch<{ data: DocAsset }>(
        `/api/docs/${docId.value}/assets/${assetId}/complete`,
        { method: "POST" },
      );
      assets.value = [completed.data, ...assets.value.filter((a) => a.id !== assetId)];
      return completed.data;
    } catch (error) {
      if (assetId) {
        void $fetch(`/api/docs/${docId.value}/assets/${assetId}`, { method: "DELETE" }).catch(() => {});
      }
      throw new Error(errorMessage(error, "Upload failed"));
    }
  }

  async function deleteAsset(assetId: string): Promise<void> {
    await $fetch(`/api/docs/${docId.value}/assets/${assetId}`, { method: "DELETE" });
    assets.value = assets.value.filter((a) => a.id !== assetId);
  }

  async function setShareEnabled(assetId: string, enabled: boolean): Promise<DocAsset> {
    const res = await $fetch<{ data: DocAsset }>(`/api/docs/${docId.value}/assets/${assetId}/share`, {
      method: enabled ? "POST" : "DELETE",
    });
    assets.value = assets.value.map((a) => (a.id === assetId ? res.data : a));
    return res.data;
  }

  async function importPdf(assetId: string): Promise<{ markdown: string; pages: number }> {
    try {
      const res = await $fetch<{ data: { markdown: string; pages: number } }>(
        `/api/docs/${docId.value}/assets/${assetId}/import`,
        { method: "POST", timeout: 300_000 },
      );
      return res.data;
    } catch (error) {
      throw new Error(errorMessage(error, "PDF import failed"));
    }
  }

  /** Uploads an inline editor image to object storage and returns its stable path. */
  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await $fetch<{ data: { path: string } }>(`/api/docs/${docId.value}/images`, {
        method: "POST",
        body: formData,
      });
      return res.data.path;
    } catch (error) {
      // Without object storage configured, keep the previous inline behavior.
      if ((error as { statusCode?: number })?.statusCode === 503) return readFileAsDataUrl(file);
      throw new Error(errorMessage(error, "Image upload failed"));
    }
  }

  return { assets, isLoading, fetchAssets, uploadAsset, deleteAsset, setShareEnabled, importPdf, uploadImage };
}
