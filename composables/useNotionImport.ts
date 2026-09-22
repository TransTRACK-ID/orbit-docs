import { toast } from "vue3-toastify";
import type { ReleaseItem } from "~/types";

export type NotionImportPhase =
  | "idle"
  | "uploading"
  | "paused"
  | "inspecting"
  | "choosing"
  | "finalizing"
  | "done"
  | "error";

export interface NotionImportMarkdownOption {
  path: string;
  size: number;
}

export interface NotionImportMeta {
  appId: string;
  versionId: string;
  heroTitle: string;
}

const STORAGE_PREFIX = "orbit-notion-import:";
const MAX_CHUNK_ATTEMPTS = 5;

const FATAL = Symbol("fatal");
const ABORTED = Symbol("aborted");
const RETRYABLE = Symbol("retryable");
type ChunkFailure = typeof FATAL | typeof ABORTED | typeof RETRYABLE;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageKeyFor(file: File): string {
  return `${STORAGE_PREFIX}${file.name}:${file.size}:${file.lastModified}`;
}

interface SavedSession extends NotionImportMeta {
  uploadId: string;
  createdAt: number;
}

function loadSavedSession(file: File): SavedSession | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(file));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSession;
    if (!saved.uploadId || !saved.createdAt) return null;
    if (Date.now() - saved.createdAt > 24 * 60 * 60 * 1000) return null;
    return saved;
  } catch {
    return null;
  }
}

function saveSession(file: File, uploadId: string, meta: NotionImportMeta) {
  try {
    localStorage.setItem(
      storageKeyFor(file),
      JSON.stringify({ uploadId, createdAt: Date.now(), ...meta })
    );
  } catch {
    // storage unavailable; resume just won't survive a reload
  }
}

function clearSavedSession(file: File | null) {
  if (!file) return;
  try {
    localStorage.removeItem(storageKeyFor(file));
  } catch {
    // ignore
  }
}

function readErrorMessage(e: any, fallback: string): string {
  return e?.data?.message || e?.statusMessage || e?.message || fallback;
}

export function useNotionImport() {
  const phase = ref<NotionImportPhase>("idle");
  const file = ref<File | null>(null);
  const uploadedBytes = ref(0);
  const totalBytes = ref(0);
  const error = ref("");
  const retryNote = ref("");
  const conflictReleaseId = ref("");
  const markdownFiles = ref<NotionImportMarkdownOption[]>([]);
  const suggestedTitle = ref("");
  const warnings = ref<string[]>([]);
  const importedRelease = ref<ReleaseItem | null>(null);

  const progress = computed(() =>
    totalBytes.value > 0 ? uploadedBytes.value / totalBytes.value : 0
  );
  const isBusy = computed(() =>
    ["uploading", "inspecting", "finalizing"].includes(phase.value)
  );

  let uploadId = "";
  let chunkSize = 4 * 1024 * 1024;
  let totalChunks = 0;
  let confirmedBytes = 0;
  const sentChunks = new Set<number>();
  let xhr: XMLHttpRequest | null = null;
  let pauseRequested = false;
  let cancelled = false;

  function chunkLength(index: number): number {
    const f = file.value;
    if (!f) return 0;
    return Math.min(chunkSize, f.size - index * chunkSize);
  }

  function fail(message: string) {
    error.value = message;
    phase.value = "error";
  }

  async function createSession(f: File, m: NotionImportMeta) {
    const res = await $fetch<{
      data: { uploadId: string; chunkSize: number; totalChunks: number };
    }>("/api/releases/import", {
      method: "POST",
      body: {
        fileName: f.name,
        totalSize: f.size,
        appId: m.appId,
        versionId: m.versionId,
        heroTitle: m.heroTitle,
      },
    });
    uploadId = res.data.uploadId;
    chunkSize = res.data.chunkSize;
    totalChunks = res.data.totalChunks;
    saveSession(f, uploadId, m);
  }

  async function resumeSession(savedUploadId: string): Promise<boolean> {
    try {
      const res = await $fetch<{
        data: {
          chunkSize: number;
          totalChunks: number;
          totalSize: number;
          status: string;
          received: number[];
        };
      }>(`/api/releases/import/${savedUploadId}/status`);

      if (res.data.totalSize !== file.value?.size) return false;

      uploadId = savedUploadId;
      chunkSize = res.data.chunkSize;
      totalChunks = res.data.totalChunks;
      for (const index of res.data.received) {
        sentChunks.add(index);
        confirmedBytes += chunkLength(index);
      }
      uploadedBytes.value = confirmedBytes;
      return true;
    } catch {
      return false;
    }
  }

  function putChunk(index: number, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      xhr = req;
      req.open(
        "PUT",
        `/api/releases/import/${uploadId}/chunk?index=${index}`
      );
      req.setRequestHeader("Content-Type", "application/octet-stream");
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          uploadedBytes.value = confirmedBytes + e.loaded;
        }
      };
      req.onload = () => {
        xhr = null;
        if (req.status >= 200 && req.status < 300) {
          resolve();
          return;
        }
        let message = `Chunk upload failed (${req.status})`;
        try {
          const body = JSON.parse(req.responseText);
          message = body?.message || body?.statusMessage || message;
        } catch {
          // keep default message
        }
        reject({
          kind: req.status >= 400 && req.status < 500 && req.status !== 408 && req.status !== 429
            ? FATAL
            : RETRYABLE,
          message,
        });
      };
      req.onerror = () => {
        xhr = null;
        reject({ kind: RETRYABLE, message: "Network error" });
      };
      req.onabort = () => {
        xhr = null;
        reject({ kind: ABORTED, message: "Aborted" });
      };
      req.send(blob);
    });
  }

  async function sendChunk(index: number): Promise<boolean> {
    const f = file.value;
    if (!f) return false;
    const blob = f.slice(index * chunkSize, index * chunkSize + chunkSize);

    for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt++) {
      if (cancelled) return false;
      if (pauseRequested) {
        phase.value = "paused";
        return false;
      }
      try {
        await putChunk(index, blob);
        sentChunks.add(index);
        confirmedBytes += blob.size;
        uploadedBytes.value = confirmedBytes;
        retryNote.value = "";
        return true;
      } catch (e: any) {
        if (cancelled) return false;
        if (e?.kind === ABORTED || pauseRequested) {
          phase.value = "paused";
          return false;
        }
        if (e?.kind === FATAL) {
          fail(e.message || "Upload failed");
          return false;
        }
        retryNote.value = `Koneksi terputus. Mencoba lagi (${attempt + 1}/${MAX_CHUNK_ATTEMPTS})…`;
        await sleep(500 * 2 ** attempt);
      }
    }

    // Exhausted retries: park the upload so the user can resume later.
    pauseRequested = true;
    phase.value = "paused";
    error.value = "Koneksi terputus. Upload dijeda, pilih Lanjutkan untuk melanjutkan.";
    return false;
  }

  async function runUpload() {
    for (let i = 0; i < totalChunks; i++) {
      if (cancelled) return;
      if (pauseRequested) {
        phase.value = "paused";
        return;
      }
      if (sentChunks.has(i)) continue;
      const ok = await sendChunk(i);
      if (!ok) return;
    }

    phase.value = "inspecting";
    const res = await $fetch<{
      data: {
        markdownFiles: NotionImportMarkdownOption[];
        suggestedTitle: string;
      };
    }>(`/api/releases/import/${uploadId}/complete`, { method: "POST" });

    markdownFiles.value = res.data.markdownFiles;
    suggestedTitle.value = res.data.suggestedTitle;

    if (res.data.markdownFiles.length === 1) {
      await finalize(res.data.markdownFiles[0]!.path);
    } else {
      phase.value = "choosing";
    }
  }

  async function start(selectedFile: File, m: NotionImportMeta) {
    reset(false);
    file.value = selectedFile;
    totalBytes.value = selectedFile.size;
    cancelled = false;
    pauseRequested = false;
    phase.value = "uploading";

    try {
      const saved = loadSavedSession(selectedFile);
      const metaMatches =
        saved &&
        saved.appId === m.appId &&
        saved.versionId === m.versionId &&
        saved.heroTitle === m.heroTitle;
      const resumed =
        saved && metaMatches ? await resumeSession(saved.uploadId) : false;
      if (!resumed) {
        if (saved) {
          if (!metaMatches) {
            try {
              await $fetch(`/api/releases/import/${saved.uploadId}`, {
                method: "DELETE",
              });
            } catch {
              // stale session will be swept by TTL
            }
          }
          clearSavedSession(selectedFile);
        }
        await createSession(selectedFile, m);
      }
      await runUpload();
    } catch (e: any) {
      if (cancelled) return;
      if (e?.statusCode === 409 && e?.data?.existingReleaseId) {
        conflictReleaseId.value = e.data.existingReleaseId;
      }
      fail(readErrorMessage(e, "Impor gagal"));
    }
  }

  async function finalize(markdownPath: string, heroTitle?: string) {
    if (!uploadId) return;
    phase.value = "finalizing";
    error.value = "";
    try {
      const res = await $fetch<{ data: ReleaseItem; warnings: string[] }>(
        `/api/releases/import/${uploadId}/finalize`,
        {
          method: "POST",
          body: {
            markdownPath,
            heroTitle: heroTitle?.trim() || undefined,
          },
        }
      );
      importedRelease.value = res.data;
      warnings.value = res.warnings || [];
      clearSavedSession(file.value);
      if (warnings.value.length) {
        toast.warning(
          `Rilis diimpor dengan ${warnings.value.length} peringatan`
        );
      } else {
        toast.success("Rilis diimpor sebagai draft");
      }
      phase.value = "done";
    } catch (e: any) {
      if (e?.statusCode === 409 && e?.data?.existingReleaseId) {
        conflictReleaseId.value = e.data.existingReleaseId;
      }
      fail(readErrorMessage(e, "Impor gagal"));
    }
  }

  function pause() {
    pauseRequested = true;
    xhr?.abort();
  }

  async function resume() {
    if (cancelled || !uploadId || !file.value) return;
    pauseRequested = false;
    error.value = "";
    retryNote.value = "";
    phase.value = "uploading";
    try {
      await runUpload();
    } catch (e: any) {
      if (cancelled) return;
      if (e?.statusCode === 409 && e?.data?.existingReleaseId) {
        conflictReleaseId.value = e.data.existingReleaseId;
      }
      fail(readErrorMessage(e, "Impor gagal"));
    }
  }

  async function cancel() {
    cancelled = true;
    xhr?.abort();
    const id = uploadId;
    const f = file.value;
    reset();
    if (id) {
      try {
        await $fetch(`/api/releases/import/${id}`, { method: "DELETE" });
      } catch {
        // session will be swept by TTL
      }
    }
    clearSavedSession(f);
  }

  /**
   * Abort the in-flight request without touching the saved session.
   * Used when the dialog unmounts mid-upload so a later visit can resume.
   */
  function shutdown() {
    pauseRequested = true;
    xhr?.abort();
  }

  function reset(clearFile = true) {
    phase.value = "idle";
    if (clearFile) file.value = null;
    uploadedBytes.value = 0;
    totalBytes.value = 0;
    error.value = "";
    retryNote.value = "";
    conflictReleaseId.value = "";
    markdownFiles.value = [];
    suggestedTitle.value = "";
    warnings.value = [];
    importedRelease.value = null;
    uploadId = "";
    totalChunks = 0;
    confirmedBytes = 0;
    sentChunks.clear();
    xhr = null;
    pauseRequested = false;
    cancelled = false;
  }

  return {
    phase,
    file,
    uploadedBytes,
    totalBytes,
    progress,
    isBusy,
    error,
    retryNote,
    conflictReleaseId,
    markdownFiles,
    suggestedTitle,
    warnings,
    importedRelease,
    start,
    finalize,
    pause,
    resume,
    cancel,
    shutdown,
    reset,
  };
}
