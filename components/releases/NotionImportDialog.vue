<script setup lang="ts">
import type { AppItem } from "~/composables/useApps";
import type { ReleaseItem } from "~/types";

const props = defineProps<{
  open: boolean;
  apps: AppItem[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "imported", release: ReleaseItem): void;
}>();

const imp = useNotionImport();
const { versions, fetchVersions, createVersion } = useVersions();

const selectedAppId = ref("");
const selectedVersionId = ref("");
const heroTitle = ref("");
const heroTitleTouched = ref(false);
const selectedMdPath = ref("");
const isDragOver = ref(false);

const appOptions = computed(() =>
  props.apps.map((a) => ({ id: a.id, label: a.name }))
);

// ── Search-or-create version combobox ─────────────────────────
const versionQuery = ref("");
const versionMenuOpen = ref(false);
const versionActiveIndex = ref(-1);
const versionComboRef = ref<HTMLDivElement | null>(null);
const isCreatingVersion = ref(false);

const cleanVersionQuery = computed(() =>
  versionQuery.value.trim().replace(/^v/i, "")
);

const versionHasArticle = (v: { releases?: Array<{ type: string }> }) =>
  v.releases?.some((r) => r.type === "article") ?? false;

const filteredVersions = computed(() => {
  const q = versionQuery.value.trim().toLowerCase();
  if (!q) return versions.value;
  return versions.value.filter((v) => v.version.toLowerCase().includes(q));
});

const exactVersionMatch = computed(
  () =>
    cleanVersionQuery.value.length > 0 &&
    versions.value.some(
      (v) =>
        v.version.replace(/^v/i, "").toLowerCase() ===
        cleanVersionQuery.value.toLowerCase()
    )
);

const canCreateVersion = computed(
  () => cleanVersionQuery.value.length > 0 && !exactVersionMatch.value
);

const comboItemCount = computed(
  () => filteredVersions.value.length + (canCreateVersion.value ? 1 : 0)
);

function onVersionQueryInput() {
  selectedVersionId.value = "";
  versionMenuOpen.value = true;
  versionActiveIndex.value = -1;
}

function selectVersion(v: { id: string; version: string }) {
  const full = versions.value.find((x) => x.id === v.id);
  if (full && versionHasArticle(full)) return;
  selectedVersionId.value = v.id;
  versionQuery.value = `v${v.version}`;
  versionMenuOpen.value = false;
}

function requestCreateVersion() {
  if (!canCreateVersion.value || !selectedAppId.value) return;
  void doCreateVersion(selectedAppId.value);
}

async function doCreateVersion(appId: string) {
  if (isCreatingVersion.value || !cleanVersionQuery.value) return;
  isCreatingVersion.value = true;
  try {
    const created = await createVersion(appId, {
      version: cleanVersionQuery.value,
      status: "draft",
    });
    if (created?.id) {
      created.appName =
        props.apps.find((a) => a.id === appId)?.name || created.appName;
      selectedVersionId.value = created.id;
      versionQuery.value = `v${created.version}`;
      versionMenuOpen.value = false;
    }
  } finally {
    isCreatingVersion.value = false;
  }
}

function onVersionFocusOut(e: FocusEvent) {
  if (!versionComboRef.value?.contains(e.relatedTarget as Node)) {
    versionMenuOpen.value = false;
  }
}

function onVersionKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!versionMenuOpen.value) {
      versionMenuOpen.value = true;
      return;
    }
    const delta = e.key === "ArrowDown" ? 1 : -1;
    const count = comboItemCount.value;
    if (!count) return;
    versionActiveIndex.value =
      (versionActiveIndex.value + delta + count) % count;
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (!versionMenuOpen.value) {
      if (canCreateVersion.value) requestCreateVersion();
      return;
    }
    const idx = versionActiveIndex.value;
    if (idx >= 0 && idx < filteredVersions.value.length) {
      selectVersion(filteredVersions.value[idx]!);
    } else if (idx === filteredVersions.value.length && canCreateVersion.value) {
      requestCreateVersion();
    }
  } else if (e.key === "Escape") {
    if (versionMenuOpen.value) {
      e.stopPropagation();
      versionMenuOpen.value = false;
    }
  }
}

const versionActiveDescendant = computed(() =>
  versionActiveIndex.value >= 0
    ? `ni-ver-opt-${versionActiveIndex.value}`
    : undefined
);

const step = computed(() => {
  if (imp.phase.value === "choosing") return "choose";
  if (imp.phase.value === "inspecting" || imp.phase.value === "finalizing")
    return "processing";
  if (
    imp.phase.value === "uploading" ||
    imp.phase.value === "paused"
  )
    return "upload";
  return "form";
});

const canSubmit = computed(
  () =>
    Boolean(selectedAppId.value) &&
    Boolean(selectedVersionId.value) &&
    Boolean(imp.file.value) &&
    !imp.isBusy.value
);

const percent = computed(() => Math.round(imp.progress.value * 100));

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function mdLabel(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || path;
}

function mdDir(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

function onInputChange(e: Event) {
  onFilePicked((e.target as HTMLInputElement).files);
}

function onFilePicked(list: FileList | null) {
  const f = list?.[0];
  if (!f) return;
  imp.error.value = "";
  if (!f.name.toLowerCase().endsWith(".zip")) {
    imp.error.value = "File harus berupa arsip .zip ekspor Notion";
    return;
  }
  imp.file.value = f;
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  onFilePicked(e.dataTransfer?.files || null);
}

function onHeroTitleInput() {
  heroTitleTouched.value = true;
}

watch(
  () => imp.phase.value,
  (phase) => {
    if (phase === "choosing") {
      selectedMdPath.value = imp.markdownFiles.value[0]?.path || "";
      if (!heroTitleTouched.value && imp.suggestedTitle.value) {
        heroTitle.value = imp.suggestedTitle.value;
      }
    }
    if (phase === "done" && imp.importedRelease.value) {
      emit("imported", imp.importedRelease.value);
    }
  }
);

watch(selectedAppId, async (appId) => {
  selectedVersionId.value = "";
  versionQuery.value = "";
  versionMenuOpen.value = false;
  versionActiveIndex.value = -1;
  if (appId) await fetchVersions(appId);
});

watch(
  () => props.open,
  (open) => {
    if (!open && imp.phase.value === "uploading") {
      imp.pause();
    }
    if (open && ["idle", "error", "done"].includes(imp.phase.value)) {
      imp.reset();
      selectedAppId.value = "";
      selectedVersionId.value = "";
      versionQuery.value = "";
      versionMenuOpen.value = false;
      versionActiveIndex.value = -1;
      heroTitle.value = "";
      heroTitleTouched.value = false;
      selectedMdPath.value = "";
      isDragOver.value = false;
    }
  }
);

onBeforeUnmount(() => {
  imp.shutdown();
});

function requestClose() {
  if (imp.phase.value === "uploading") imp.pause();
  emit("close");
}

async function submitImport() {
  if (!canSubmit.value || !imp.file.value) return;
  await imp.start(imp.file.value, {
    appId: selectedAppId.value,
    versionId: selectedVersionId.value,
    heroTitle: heroTitle.value.trim(),
  });
}

async function submitFinalize() {
  if (!selectedMdPath.value) return;
  await imp.finalize(selectedMdPath.value, heroTitle.value);
}

async function cancelImport() {
  await imp.cancel();
  emit("close");
}
</script>

<template>
  <div
    class="ni-modal"
    :class="{ open: props.open }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="niTitle"
    tabindex="-1"
    @click.self="requestClose"
  >
    <div class="ni-drawer">
      <div class="ni-header">
        <h3 id="niTitle">Impor dari Notion</h3>
        <button
          type="button"
          class="btn btn-ghost ni-close"
          aria-label="Tutup"
          @click="requestClose"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="ni-body">
        <div v-if="imp.error.value" class="error-banner" role="alert">
          <span>{{ imp.error.value }}</span>
          <NuxtLink
            v-if="imp.conflictReleaseId.value"
            :to="`/releases/${imp.conflictReleaseId.value}`"
            class="ni-conflict-link"
          >
            Buka rilis yang ada
          </NuxtLink>
        </div>

        <!-- Step: form -->
        <template v-if="step === 'form'">
          <div class="ni-field">
            <GeneralSearchableDropdown
              v-model="selectedAppId"
              :options="appOptions"
              label="Aplikasi"
              placeholder="Pilih aplikasi"
              search-placeholder="Cari aplikasi..."
            />
          </div>

          <div class="ni-field">
            <label for="niVersion">Versi</label>
            <div
              ref="versionComboRef"
              class="ni-combo"
              @focusout="onVersionFocusOut"
            >
              <input
                id="niVersion"
                v-model="versionQuery"
                type="text"
                class="ni-combo-input"
                :placeholder="
                  selectedAppId
                    ? 'Cari atau ketik versi baru, mis. 1.2.0'
                    : 'Pilih aplikasi dulu'
                "
                :disabled="!selectedAppId"
                role="combobox"
                :aria-expanded="versionMenuOpen"
                aria-controls="niVersionList"
                :aria-activedescendant="versionActiveDescendant"
                autocomplete="off"
                spellcheck="false"
                @focus="versionMenuOpen = true"
                @input="onVersionQueryInput"
                @keydown="onVersionKeydown"
              />
              <div
                v-if="versionMenuOpen"
                id="niVersionList"
                class="ni-combo-menu"
                role="listbox"
                aria-label="Versi"
              >
                <button
                  v-for="(v, i) in filteredVersions"
                  :id="`ni-ver-opt-${i}`"
                  :key="v.id"
                  type="button"
                  class="ni-combo-option"
                  :class="{
                    active: v.id === selectedVersionId,
                    highlighted: i === versionActiveIndex,
                  }"
                  role="option"
                  :aria-selected="v.id === selectedVersionId"
                  :disabled="versionHasArticle(v)"
                  @mousedown.prevent="selectVersion(v)"
                  @mouseenter="versionActiveIndex = i"
                >
                  <span class="ni-combo-label">v{{ v.version }}</span>
                  <span v-if="versionHasArticle(v)" class="ni-combo-tag">
                    artikel ada
                  </span>
                  <svg
                    v-else-if="v.id === selectedVersionId"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="ni-combo-check"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>

                <button
                  v-if="canCreateVersion"
                  :id="`ni-ver-opt-${filteredVersions.length}`"
                  type="button"
                  class="ni-combo-option is-create"
                  :class="{
                    highlighted: versionActiveIndex === filteredVersions.length,
                  }"
                  role="option"
                  :aria-selected="false"
                  :disabled="isCreatingVersion"
                  @mousedown.prevent="requestCreateVersion"
                  @mouseenter="versionActiveIndex = filteredVersions.length"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span class="ni-combo-label">
                    {{ isCreatingVersion ? "Membuat…" : `Buat versi “v${cleanVersionQuery}”` }}
                  </span>
                </button>

                <div
                  v-if="!filteredVersions.length && !canCreateVersion"
                  class="ni-combo-empty"
                  role="alert"
                >
                  Tidak ada versi cocok
                </div>
              </div>
            </div>
            <span class="ni-hint">
              Belum ada versi? Ketik nomor versi lalu Enter untuk membuatnya.
              Versi yang sudah punya artikel rilis dinonaktifkan.
            </span>
          </div>

          <div class="ni-field">
            <label for="niHeroTitle">Judul hero <span class="ni-optional">opsional</span></label>
            <input
              id="niHeroTitle"
              v-model="heroTitle"
              type="text"
              placeholder="Otomatis dari judul dokumen"
              @input="onHeroTitleInput"
            />
          </div>

          <div class="ni-field">
            <span class="ni-field-label">Arsip ekspor Notion</span>
            <label
              class="ni-dropzone"
              :class="{ 'is-dragover': isDragOver, 'has-file': imp.file.value }"
              for="niFileInput"
              @dragover.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @drop.prevent="onDrop"
            >
              <input
                id="niFileInput"
                type="file"
                accept=".zip,application/zip"
                class="ni-file-input"
                @change="onInputChange"
              />
              <template v-if="imp.file.value">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span class="ni-file-name" :title="imp.file.value.name">{{ imp.file.value.name }}</span>
                <span class="ni-file-size">{{ formatSize(imp.file.value.size) }}</span>
                <span class="ni-file-replace">Klik atau tarik file lain untuk mengganti</span>
              </template>
              <template v-else>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span class="ni-drop-title">Tarik file .zip ke sini, atau klik untuk memilih</span>
                <span class="ni-drop-hint">Ekspor Notion (Markdown &amp; CSV), maks 200 MB</span>
              </template>
            </label>
          </div>
        </template>

        <!-- Step: uploading / paused -->
        <template v-else-if="step === 'upload'">
          <div class="ni-file-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span class="ni-file-name">{{ imp.file.value?.name }}</span>
            <span class="ni-file-size">{{ formatSize(imp.totalBytes.value) }}</span>
          </div>

          <div
            class="ni-progress"
            role="progressbar"
            :aria-valuenow="percent"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Progres unggahan"
          >
            <div
              class="ni-progress-fill"
              :style="{ transform: `scaleX(${imp.progress.value})` }"
            />
          </div>

          <div class="ni-progress-meta">
            <span class="ni-progress-count">
              {{ formatSize(imp.uploadedBytes.value) }} dari {{ formatSize(imp.totalBytes.value) }}
            </span>
            <span class="ni-progress-pct">{{ percent }}%</span>
          </div>

          <p v-if="imp.retryNote.value" class="ni-note">{{ imp.retryNote.value }}</p>
          <p v-else-if="imp.phase.value === 'paused'" class="ni-note">
            Upload dijeda. Pilih Lanjutkan untuk melanjutkan dari titik terakhir.
          </p>

          <div class="ni-upload-actions">
            <button
              v-if="imp.phase.value === 'uploading'"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="imp.pause()"
            >
              Jeda
            </button>
            <button
              v-else
              type="button"
              class="btn btn-primary btn-sm"
              @click="imp.resume()"
            >
              Lanjutkan
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="cancelImport"
            >
              Batalkan impor
            </button>
          </div>
        </template>

        <!-- Step: choose document -->
        <template v-else-if="step === 'choose'">
          <p class="ni-choose-intro">
            Arsip berisi {{ imp.markdownFiles.value.length }} dokumen. Pilih satu untuk dijadikan artikel rilis.
          </p>
          <div class="ni-md-list" role="radiogroup" aria-label="Dokumen dalam arsip">
            <label
              v-for="opt in imp.markdownFiles.value"
              :key="opt.path"
              class="ni-md-option"
              :class="{ active: selectedMdPath === opt.path }"
            >
              <input
                v-model="selectedMdPath"
                type="radio"
                name="ni-md"
                :value="opt.path"
                class="ni-md-radio"
              />
              <span class="ni-md-info">
                <span class="ni-md-name">{{ mdLabel(opt.path) }}</span>
                <span v-if="mdDir(opt.path)" class="ni-md-dir">{{ mdDir(opt.path) }}</span>
              </span>
              <span class="ni-file-size">{{ formatSize(opt.size) }}</span>
            </label>
          </div>

          <div class="ni-field">
            <label for="niHeroTitlePick">Judul hero <span class="ni-optional">opsional</span></label>
            <input
              id="niHeroTitlePick"
              v-model="heroTitle"
              type="text"
              placeholder="Otomatis dari judul dokumen"
              @input="onHeroTitleInput"
            />
          </div>
        </template>

        <!-- Step: processing -->
        <template v-else>
          <div class="ni-processing">
            <div class="ni-progress ni-progress--indeterminate" aria-hidden="true">
              <div class="ni-progress-fill" />
            </div>
            <p class="ni-note">
              {{ imp.phase.value === 'inspecting'
                ? 'Membaca isi arsip…'
                : 'Mengunggah aset dan membuat rilis…' }}
            </p>
          </div>
        </template>
      </div>

      <div v-if="step === 'form' || step === 'choose'" class="ni-footer">
        <template v-if="step === 'form'">
          <button type="button" class="btn btn-secondary" @click="requestClose">
            Batal
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!canSubmit"
            @click="submitImport"
          >
            Impor
          </button>
        </template>
        <template v-else-if="step === 'choose'">
          <button type="button" class="btn btn-ghost" @click="cancelImport">
            Batalkan
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!selectedMdPath"
            @click="submitFinalize"
          >
            Impor dokumen
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ni-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: color-mix(in oklch, var(--fg) 25%, transparent);
  backdrop-filter: blur(4px);
}

.ni-modal.open {
  display: flex;
}

.ni-drawer {
  width: 100%;
  max-width: 520px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 24px;
}

.ni-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.ni-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

.ni-close {
  padding: 6px;
}

.ni-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ni-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ni-field > label,
.ni-field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}

.ni-field input[type="text"] {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}

.ni-field input[type="text"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ni-optional {
  font-weight: 400;
  color: var(--muted);
}

.ni-hint {
  font-size: 12px;
  color: var(--muted);
}

.ni-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ni-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 20px;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  color: var(--muted);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ni-dropzone:hover,
.ni-dropzone.is-dragover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--fg);
}

.ni-dropzone:has(.ni-file-input:focus-visible) {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ni-drop-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
}

.ni-drop-hint {
  font-size: 12px;
  color: var(--muted);
}

.ni-dropzone.has-file {
  border-style: solid;
  padding: 18px 20px;
}

.ni-dropzone .ni-file-name {
  flex: none;
  max-width: 100%;
}

.ni-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
  min-width: 0;
}

.ni-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
}

.ni-file-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.ni-file-replace {
  font-size: 12px;
  color: var(--muted);
}

.ni-progress {
  height: 6px;
  border-radius: 999px;
  background: var(--fg-soft);
  overflow: hidden;
}

.ni-progress-fill {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: var(--accent);
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 0.2s ease-out;
}

.ni-progress--indeterminate .ni-progress-fill {
  width: 40%;
  transform-origin: left center;
  animation: ni-indeterminate 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes ni-indeterminate {
  0% {
    transform: translateX(-100%) scaleX(0.4);
  }
  100% {
    transform: translateX(260%) scaleX(0.4);
  }
}

.ni-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ni-progress-count,
.ni-progress-pct {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

.ni-note {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.ni-upload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ni-choose-intro {
  margin: 0;
  font-size: 14px;
  color: var(--fg);
  line-height: 1.5;
}

.ni-md-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px;
  background: var(--bg);
}

.ni-md-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.ni-md-option:hover {
  background: var(--fg-soft);
}

.ni-md-option.active {
  background: var(--accent-soft);
}

.ni-md-option:has(.ni-md-radio:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.ni-md-radio {
  accent-color: var(--accent);
  flex-shrink: 0;
}

.ni-md-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ni-md-name {
  font-size: 14px;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ni-md-dir {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ni-processing {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.ni-combo {
  position: relative;
}

.ni-combo-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}

.ni-combo-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ni-combo-input::placeholder {
  color: var(--muted);
}

.ni-combo-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow:
    0 1px 2px color-mix(in oklch, var(--fg) 4%, transparent),
    0 4px 12px color-mix(in oklch, var(--fg) 8%, transparent);
}

.ni-combo-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}

.ni-combo-option:hover:not(:disabled),
.ni-combo-option.highlighted {
  background: var(--fg-soft);
}

.ni-combo-option.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.ni-combo-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ni-combo-option.is-create {
  color: var(--accent);
  font-weight: 500;
}

.ni-combo-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ni-combo-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.ni-combo-check {
  color: var(--accent);
  flex-shrink: 0;
}

.ni-combo-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.ni-conflict-link {
  display: inline-block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ni-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}

@media (prefers-reduced-motion: reduce) {
  .ni-dropzone,
  .ni-md-option,
  .ni-progress-fill {
    transition: none;
  }
  .ni-progress--indeterminate .ni-progress-fill {
    animation: none;
    transform: none;
    width: 100%;
  }
}
</style>
