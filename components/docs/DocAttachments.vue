<script setup lang="ts">
import {
  DOC_ASSET_ACCEPT,
  formatBytes,
  type DocAsset,
  type useDocAssets,
} from "~/composables/useDocAssets";

export type PdfImportMode = "replace" | "append";

const props = defineProps<{
  store: ReturnType<typeof useDocAssets>;
  canEdit: boolean;
  docHasContent: boolean;
  importingId: string | null;
}>();

const emit = defineEmits<{
  (e: "preview", asset: DocAsset): void;
  (e: "import", asset: DocAsset, mode: PdfImportMode): void;
  (e: "insert-video", asset: DocAsset): void;
  (e: "notify", message: string): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploadProgress = ref<number | null>(null);
const uploadName = ref("");
const choosingImportFor = ref<string | null>(null);
const assetToDelete = ref<DocAsset | null>(null);
const isDeleting = ref(false);
const cancelDeleteRef = ref<HTMLButtonElement | null>(null);

const pdfs = computed(() => props.store.assets.value.filter((a) => a.kind === "pdf"));
const videos = computed(() => props.store.assets.value.filter((a) => a.kind === "video"));
const hasNoAssets = computed(() => !props.store.isLoading.value && props.store.assets.value.length === 0);
const accept = `${DOC_ASSET_ACCEPT.pdf},${DOC_ASSET_ACCEPT.video}`;

function pickFile() {
  fileInput.value?.click();
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  uploadName.value = file.name;
  uploadProgress.value = 0;
  try {
    const asset = await props.store.uploadAsset(file, (fraction) => {
      uploadProgress.value = fraction;
    });
    if (asset.kind === "video") {
      emit("insert-video", asset);
      emit("notify", "Video added to the document");
    } else {
      emit("notify", "PDF uploaded");
    }
  } catch (error) {
    emit("notify", error instanceof Error ? error.message : "Upload failed. Try again.");
  } finally {
    uploadProgress.value = null;
    uploadName.value = "";
  }
}

function startImport(asset: DocAsset) {
  if (!props.docHasContent) {
    emit("import", asset, "replace");
    return;
  }
  choosingImportFor.value = choosingImportFor.value === asset.id ? null : asset.id;
}

function chooseImport(asset: DocAsset, mode: PdfImportMode) {
  choosingImportFor.value = null;
  emit("import", asset, mode);
}

function askDelete(asset: DocAsset) {
  assetToDelete.value = asset;
  nextTick(() => cancelDeleteRef.value?.focus());
}

async function confirmDelete() {
  if (!assetToDelete.value) return;
  isDeleting.value = true;
  const kind = assetToDelete.value.kind === "pdf" ? "PDF" : "Video";
  try {
    await props.store.deleteAsset(assetToDelete.value.id);
    emit("notify", `${kind} deleted`);
  } catch {
    emit("notify", `Couldn't delete the ${kind.toLowerCase()}. Try again.`);
  } finally {
    isDeleting.value = false;
    assetToDelete.value = null;
  }
}

function onDialogKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !isDeleting.value) assetToDelete.value = null;
}
</script>

<template>
  <div class="attachments-panel">
    <div v-if="canEdit" class="attach-upload">
      <input
        ref="fileInput"
        type="file"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        :accept="accept"
        @change="onFileChosen"
      />
      <button
        type="button"
        class="btn btn-secondary attach-upload-btn"
        :disabled="uploadProgress !== null"
        @click="pickFile"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {{ uploadProgress !== null ? "Uploading…" : "Upload PDF or video" }}
      </button>
      <div v-if="uploadProgress !== null" class="attach-progress" role="status" aria-live="polite">
        <div class="attach-progress-meta">
          <span class="attach-progress-name">{{ uploadName }}</span>
          <span class="mono">{{ Math.round(uploadProgress * 100) }}%</span>
        </div>
        <div
          class="attach-progress-track"
          role="progressbar"
          :aria-valuenow="Math.round(uploadProgress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Uploading ${uploadName}`"
        >
          <div class="attach-progress-bar" :style="{ transform: `scaleX(${uploadProgress})` }" />
        </div>
      </div>
    </div>

    <div v-if="store.isLoading.value && store.assets.value.length === 0" class="attach-skeleton" aria-hidden="true">
      <div v-for="n in 2" :key="n" class="attach-skeleton-row">
        <div class="attach-skeleton-icon" />
        <div class="attach-skeleton-lines">
          <div class="attach-skeleton-line" />
          <div class="attach-skeleton-line attach-skeleton-line--short" />
        </div>
      </div>
    </div>

    <div v-else-if="hasNoAssets" class="attach-empty">
      <p class="attach-empty-title">No attachments</p>
      <p class="attach-empty-body">
        <template v-if="canEdit">
          Upload a PDF to preview it, share a public link, or turn its text into this document.
          Videos are added inline with a transcript the assistant can cite by minute.
        </template>
        <template v-else>PDFs and videos attached to this document appear here.</template>
      </p>
    </div>

    <section v-if="pdfs.length" class="attach-group" aria-labelledby="attachPdfLabel">
      <h3 id="attachPdfLabel" class="attach-group-label">PDF</h3>
      <ul class="attach-list" role="list">
        <li v-for="asset in pdfs" :key="asset.id" class="attach-item">
          <button
            type="button"
            class="attach-main"
            :aria-label="`Preview ${asset.title}`"
            @click="emit('preview', asset)"
          >
            <span class="attach-icon attach-icon--pdf" aria-hidden="true">PDF</span>
            <span class="attach-copy">
              <span class="attach-name" :title="asset.fileName">{{ asset.title }}</span>
              <span class="attach-meta">
                <span class="mono">{{ formatBytes(asset.sizeBytes) }}</span>
                <span v-if="asset.shareEnabled" class="attach-shared">Public link on</span>
              </span>
            </span>
          </button>

          <div v-if="canEdit" class="attach-actions">
            <button
              type="button"
              class="attach-action"
              :disabled="importingId !== null"
              :aria-expanded="docHasContent ? choosingImportFor === asset.id : undefined"
              @click="startImport(asset)"
            >
              {{ importingId === asset.id ? "Importing…" : "Import to editor" }}
            </button>
            <button type="button" class="attach-action attach-action--danger" @click="askDelete(asset)">
              Delete
            </button>
          </div>

          <div v-if="choosingImportFor === asset.id" class="attach-import-choice" role="group" aria-label="How to import">
            <p>This document already has content.</p>
            <div class="attach-import-buttons">
              <button type="button" class="btn btn-secondary btn-sm" @click="chooseImport(asset, 'append')">
                Add to end
              </button>
              <button type="button" class="btn btn-secondary btn-sm" @click="chooseImport(asset, 'replace')">
                Replace content
              </button>
              <button type="button" class="btn btn-ghost btn-sm" @click="choosingImportFor = null">Cancel</button>
            </div>
            <p class="attach-import-note">Replacing saves the current content as a version first.</p>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="videos.length" class="attach-group" aria-labelledby="attachVideoLabel">
      <h3 id="attachVideoLabel" class="attach-group-label">Video</h3>
      <ul class="attach-list" role="list">
        <li v-for="asset in videos" :key="asset.id" class="attach-item">
          <div class="attach-main attach-main--static">
            <span class="attach-icon attach-icon--video" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            </span>
            <span class="attach-copy">
              <span class="attach-name" :title="asset.fileName">{{ asset.title }}</span>
              <span class="attach-meta"><span class="mono">{{ formatBytes(asset.sizeBytes) }}</span></span>
            </span>
          </div>
          <div v-if="canEdit" class="attach-actions">
            <button type="button" class="attach-action" @click="emit('insert-video', asset)">Insert in document</button>
            <button type="button" class="attach-action attach-action--danger" @click="askDelete(asset)">Delete</button>
          </div>
        </li>
      </ul>
    </section>

    <Teleport to="body">
      <div
        class="modal-overlay"
        :class="{ open: !!assetToDelete }"
        @click.self="!isDeleting && (assetToDelete = null)"
        @keydown="onDialogKeydown"
      >
        <div
          v-if="assetToDelete"
          class="modal modal--narrow"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="deleteAttachmentTitle"
          aria-describedby="deleteAttachmentDesc"
        >
          <div class="modal-header">
            <h2 id="deleteAttachmentTitle">Delete {{ assetToDelete.kind === "pdf" ? "PDF" : "video" }}?</h2>
          </div>
          <div class="modal-body">
            <p id="deleteAttachmentDesc" class="modal-text">
              <strong>{{ assetToDelete.title }}</strong> will be deleted permanently.
              <template v-if="assetToDelete.kind === 'video'">Video blocks that use it stop playing.</template>
              <template v-else-if="assetToDelete.shareEnabled">Its public link stops working.</template>
            </p>
          </div>
          <div class="modal-foot">
            <button ref="cancelDeleteRef" type="button" class="btn btn-secondary" :disabled="isDeleting" @click="assetToDelete = null">
              Keep it
            </button>
            <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="confirmDelete">
              {{ isDeleting ? "Deleting…" : `Delete ${assetToDelete.kind === "pdf" ? "PDF" : "video"}` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.attachments-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.attach-upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.attach-upload-btn {
  width: 100%;
}

.attach-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attach-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.attach-progress-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attach-progress-track {
  height: 4px;
  border-radius: 999px;
  background: var(--fg-soft);
  overflow: hidden;
}

.attach-progress-bar {
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.attach-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.attach-skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.attach-skeleton-icon,
.attach-skeleton-line {
  background: var(--fg-soft);
  border-radius: var(--radius);
}

.attach-skeleton-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.attach-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attach-skeleton-line {
  height: 10px;
  width: 80%;
}

.attach-skeleton-line--short {
  width: 40%;
}

.attach-empty-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.attach-empty-body {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
}

.attach-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attach-group-label {
  margin: 0 0 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.attach-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attach-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 -8px;
  padding: 8px;
  border-radius: var(--radius);
  transition: background 0.15s;
}

.attach-item:hover,
.attach-item:focus-within {
  background: var(--fg-soft);
}

.attach-main {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: var(--radius);
}

.attach-main--static {
  cursor: default;
}

.attach-main:hover .attach-name {
  color: var(--accent);
}

.attach-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.attach-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.attach-icon--pdf {
  background: color-mix(in oklch, var(--error) 12%, transparent);
  color: var(--error-text);
}

.attach-icon--video {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
}

.attach-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.attach-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}

.attach-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted);
}

.attach-shared {
  color: var(--success-text);
}

.attach-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-left: 40px;
}

.attach-action {
  padding: 2px 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
}

.attach-action:hover:not(:disabled) {
  color: var(--fg);
}

.attach-action--danger:hover:not(:disabled) {
  color: var(--error-text);
}

.attach-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.attach-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.attach-import-choice {
  margin: 4px 0 0 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12.5px;
  color: var(--fg);
}

.attach-import-choice p {
  margin: 0;
}

.attach-import-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attach-import-note {
  font-size: 11.5px;
  color: var(--muted);
}

@media (prefers-reduced-motion: reduce) {
  .attach-progress-bar,
  .attach-item,
  .attach-name {
    transition: none;
  }
}
</style>
