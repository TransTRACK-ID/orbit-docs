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

/** POST multipart to Orbit (same origin as images). Progress via XHR upload events. */
function uploadViaServer(
  url: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<DocAsset> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let message = `Upload failed (HTTP ${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { data?: DocAsset; message?: string };
        if (xhr.status >= 200 && xhr.status < 300 && body.data) {
          resolve(body.data);
          return;
        }
        message = body.message || message;
      } catch {
        /* non-JSON error body */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your network connection and try again."));
    xhr.send(formData);
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
    if (!docId.value) throw new Error("Upload failed");
    try {
      const asset = await uploadViaServer(
        `/api/docs/${docId.value}/assets/upload`,
        file,
        onProgress,
      );
      assets.value = [asset, ...assets.value.filter((a) => a.id !== asset.id)];
      return asset;
    } catch (error) {
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
