<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { copyChangelogToClipboard } from "~/composables/useClipboard";
import { renderMarkdown, extractHeadings, headingSlug } from "~/composables/useMarkdown";
import { formatDisplayVersion, formatReleaseHeading } from "~/utils/functions";
import { getHistoryActionClass, getHistoryActionLabel } from "~/utils/history-actions";
import type { ReleaseItem, ReleaseFeature, ReleaseMedia, ReleaseCategories, ReleaseVersion } from "~/types";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const route = useRoute();
const router = useRouter();
const { can } = usePermissions();

const canWriteReleases = computed(() => can("releases:write"));
const canPublishReleases = computed(() => can("releases:publish"));
const canWriteChangelogs = computed(() => can("changelogs:write"));

const { release, isLoading, isUpdating, isDeleting, fetchRelease, updateRelease, deleteRelease } = useReleases();
const { uploadReleaseImage } = useReleaseMediaUpload();

const releaseId = computed(() => route.params.id as string);

// Fetch all published releases for prev/next navigation
const allReleases = ref<ReleaseItem[]>([]);
const isFetchingList = ref(false);

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeunload", onBeforeUnload);
  if (releaseId.value) {
    await fetchRelease(releaseId.value);
    if (release.value?.type === "article") {
      await fetchReleaseVersions();
    }
    // Auto-enter edit mode when coming from list "Edit release" link
    if (route.query.edit === "1" && release.value?.type === "article") {
      enterEditMode();
    }
    isFetchingList.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem[] }>("/api/releases", {
        query: { limit: "100" },
      });
      allReleases.value = data.data;
    } catch (e) {
      console.error("Failed to fetch releases list", e);
    } finally {
      isFetchingList.value = false;
    }
  }
});

watch(release, (r) => {
  if (r?.appName) {
    $page.setTitle(formatReleaseHeading(r.appName, r.version, r.heroTitle));
  }
  playingMedia.value = {};
  videoEls.value = {};
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════
const categoryConfig: Record<string, { label: string; pillClass: string }> = {
  fixed: { label: "Fixed", pillClass: "pill-blue" },
  added: { label: "Added", pillClass: "pill-green" },
  changed: { label: "Changed", pillClass: "pill-amber" },
  deprecated: { label: "Deprecated", pillClass: "pill-purple" },
  security: { label: "Security", pillClass: "pill-red" },
};

function countCategories(categories: ReleaseCategories | null) {
  return {
    fixed: categories?.fixed || [],
    added: categories?.added || [],
    changed: categories?.changed || [],
    deprecated: categories?.deprecated || [],
    security: categories?.security || [],
  };
}

const featureOutlineItems = computed(() =>
  (release.value?.features || []).map((f: ReleaseFeature) => ({
    id: f.id,
    label: f.heading,
    level: 2,
  }))
);

// ═══════════════════════════════════════════════════════════════
// Prev / Next
// ═══════════════════════════════════════════════════════════════
const adjacent = computed(() => {
  const sorted = [...allReleases.value].sort((a, b) => {
    const da = new Date(b.releaseDate || b.createdAt || 0).getTime();
    const db = new Date(a.releaseDate || a.createdAt || 0).getTime();
    return da - db;
  });
  const idx = sorted.findIndex((r) => r.id === releaseId.value);
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
});

// ═══════════════════════════════════════════════════════════════
// Media helpers
// ═══════════════════════════════════════════════════════════════
const playingMedia = ref<Record<string, boolean>>({});
const videoEls = ref<Record<string, any>>({});

function mediaKey(featureId: string, idx: number) {
  return `${featureId}-${idx}`;
}

function toggleVideo(key: string) {
  const el = videoEls.value[key];
  if (!el) return;
  if (el.paused) {
    el.play();
    playingMedia.value[key] = true;
  } else {
    el.pause();
    playingMedia.value[key] = false;
  }
}

function isMediaPlaceholder(m: ReleaseMedia) {
  return !m.src;
}

// ═══════════════════════════════════════════════════════════════
// Edit mode — technical-editor-style workspace (Editor.js)
// ═══════════════════════════════════════════════════════════════
const isEditing = ref(false);
const editError = ref("");
const editContent = ref("");

const editDraft = reactive<{
  heroTitle: string;
  published: boolean;
}>({
  heroTitle: "",
  published: false,
});

const previewOnly = ref(false);
const rightSidebarTab = ref<"properties" | "versions">("properties");
const activeHeading = ref("");
const paneBodyRef = ref<HTMLElement | null>(null);

const editHeadings = computed(() => extractHeadings(editContent.value || ""));
const previewHtml = computed(() => renderMarkdown(editContent.value || ""));

const hasEditChanges = computed(() => {
  if (!release.value) return false;
  return (
    editContent.value !== (release.value.summary || "")
    || editDraft.heroTitle !== (release.value.heroTitle || "")
    || editDraft.published !== release.value.published
  );
});

const saveStatusLabel = computed(() => {
  if (!isEditing.value) return "";
  if (isUpdating.value) return "Saving…";
  if (hasEditChanges.value) return "Unsaved changes";
  return "";
});

const saveButtonLabel = computed(() =>
  editDraft.published && !release.value?.published ? "Publish" : "Save Changes"
);

const lastModified = computed(() => {
  if (!release.value?.updatedAt) return "";
  const d = new Date(release.value.updatedAt);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
});

function enterEditMode() {
  if (!release.value) return;
  editDraft.heroTitle = release.value.heroTitle || '';
  editDraft.published = release.value.published;
  editContent.value = release.value.summary || '';
  editError.value = '';
  previewOnly.value = false;
  rightSidebarTab.value = "properties";
  activeHeading.value = "";
  isEditing.value = true;
}

function uploadReleaseEditorImage(file: File) {
  if (!releaseId.value) {
    throw new Error("Release ID is missing");
  }
  return uploadReleaseImage(releaseId.value, file);
}

function cancelEdit() {
  isEditing.value = false;
  previewOnly.value = false;
  editError.value = '';
  editContent.value = '';
}

async function saveEdit() {
  if (!release.value) return;
  editError.value = '';

  const wasPublished = release.value.published;
  const versionAction = editDraft.published && !wasPublished ? "publish" : "save";

  await updateRelease(release.value.id, {
    heroTitle: editDraft.heroTitle,
    summary: editContent.value,
    published: editDraft.published,
    versionAction,
  });
  await fetchReleaseVersions();
  isEditing.value = false;
  previewOnly.value = false;
  editContent.value = '';
}

function togglePreview() {
  previewOnly.value = !previewOnly.value;
}

function switchSidebarTab(tab: "properties" | "versions") {
  rightSidebarTab.value = tab;
  if (tab === "versions") fetchReleaseVersions();
}

function scrollElementIntoContainer(container: HTMLElement, el: HTMLElement) {
  const top =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    16;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function scrollToHeading(text: string) {
  activeHeading.value = text;
  const container = paneBodyRef.value;
  if (!container) return;

  if (previewOnly.value) {
    const slug = headingSlug(text);
    let el = container.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    if (!el) {
      for (const heading of container.querySelectorAll<HTMLElement>("h1, h2, h3")) {
        if (heading.textContent?.trim() === text) {
          el = heading;
          break;
        }
      }
    }
    if (el) {
      scrollElementIntoContainer(container, el);
      return;
    }
  }

  const headers = container.querySelectorAll<HTMLElement>(".ce-header");
  for (const header of headers) {
    if (header.textContent?.trim() === text) {
      scrollElementIntoContainer(container, header);
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Version history (article releases)
// ═══════════════════════════════════════════════════════════════
const showHistoryPanel = ref(false);
const releaseVersions = ref<ReleaseVersion[]>([]);
const isHistoryLoading = ref(false);

const {
  diff: historyDiff,
  isLoading: isDiffLoading,
  error: diffError,
  isOpen: diffOpen,
  fetchReleaseDiff,
  openDiff,
  closeDiff,
} = useHistoryDiff();

async function fetchReleaseVersions() {
  if (!releaseId.value || release.value?.type !== "article") return;
  isHistoryLoading.value = true;
  try {
    const data = await $fetch<{ data: ReleaseVersion[] }>(`/api/releases/${releaseId.value}/versions`);
    releaseVersions.value = data.data;
  } catch {
    releaseVersions.value = [];
  } finally {
    isHistoryLoading.value = false;
  }
}

function openReleaseHistory() {
  showHistoryPanel.value = true;
  document.body.style.overflow = "hidden";
  fetchReleaseVersions();
}

function closeReleaseHistory() {
  showHistoryPanel.value = false;
  document.body.style.overflow = "";
}

async function viewReleaseVersionDiff(item: ReleaseVersion) {
  if (!releaseId.value) return;
  openDiff();
  await fetchReleaseDiff(releaseId.value, "", item.id);
}

async function onDiffFromChange(fromId: string) {
  if (!releaseId.value || !historyDiff.value) return;
  await fetchReleaseDiff(releaseId.value, fromId, historyDiff.value.to.id);
}

async function onDiffToChange(toId: string) {
  if (!releaseId.value || !historyDiff.value) return;
  await fetchReleaseDiff(releaseId.value, historyDiff.value.from.id, toId);
}

function formatHistoryTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewReleaseContent(text: string | null, maxLen = 140) {
  if (!text) return "No content";
  const cleaned = text.replace(/^\s*[#\-*\d.\[\]>\s]+/gm, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).replace(/\s+[^\s]*$/, "")}…`;
}

// ═══════════════════════════════════════════════════════════════
// Version restore
// ═══════════════════════════════════════════════════════════════
const restoreConfirmVisible = ref(false);
const versionToRestore = ref<ReleaseVersion | null>(null);
const isRestoring = ref(false);

function restoreVersion(version: ReleaseVersion) {
  if (!canWriteReleases.value) return;
  versionToRestore.value = version;
  restoreConfirmVisible.value = true;
}

async function confirmRestore() {
  if (!release.value || !versionToRestore.value) return;
  isRestoring.value = true;
  try {
    await updateRelease(release.value.id, {
      heroTitle: versionToRestore.value.heroTitle ?? "",
      summary: versionToRestore.value.summary ?? "",
      versionAction: "restore",
    });
    if (release.value) {
      editDraft.heroTitle = release.value.heroTitle || "";
      editDraft.published = release.value.published;
      editContent.value = release.value.summary || "";
    }
    await fetchReleaseVersions();
    cancelRestore();
  } finally {
    isRestoring.value = false;
  }
}

function cancelRestore() {
  restoreConfirmVisible.value = false;
  versionToRestore.value = null;
}

// ═══════════════════════════════════════════════════════════════
// Delete modal
// ═══════════════════════════════════════════════════════════════
const showDeleteModal = ref(false);
const isDeletingLocal = ref(false);

function confirmDelete() {
  showDeleteModal.value = true;
}

async function doDelete() {
  if (!release.value) return;
  isDeletingLocal.value = true;
  try {
    await deleteRelease(release.value.id);
    showDeleteModal.value = false;
    router.push("/releases");
  } finally {
    isDeletingLocal.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    showDeleteModal.value = false;
    if (restoreConfirmVisible.value) cancelRestore();
    if (showHistoryPanel.value) closeReleaseHistory();
  }
  if (!isEditing.value) return;
  // Ctrl+S / Cmd+S — Save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (canWriteReleases.value && !isUpdating.value) saveEdit();
  }
  // Ctrl+P / Cmd+P — Preview toggle
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    togglePreview();
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (isEditing.value && hasEditChanges.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (isEditing.value && hasEditChanges.value) {
    const ok = window.confirm("You have unsaved changes to this release article. Leave without saving?");
    next(ok);
    return;
  }
  next();
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("beforeunload", onBeforeUnload);
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="release-detail-page">
    <!-- Loading -->
    <div v-if="isLoading" class="empty-state">
      <p>Loading release…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="!release" class="empty-state">
      <p>Release not found</p>
      <span class="meta-label">The release you're looking for doesn't exist or hasn't been published.</span>
      <br><br>
      <NuxtLink to="/releases" class="btn btn-primary">View all releases</NuxtLink>
    </div>

    <!-- ═══ EDIT MODE — technical-editor workspace ═══ -->
    <div v-else-if="isEditing" class="editor-page">
      <header class="editor-topbar">
        <div class="flex-gap-md">
          <button
            type="button"
            class="btn btn-ghost back-btn"
            title="Back to release"
            @click="cancelEdit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>Release Editor</h1>
          <span class="pill pill-accent">{{ formatReleaseHeading(release.appName, release.version, editDraft.heroTitle) }}</span>
          <span class="pill" :class="editDraft.published ? 'pill-green' : 'pill-muted'">
            {{ editDraft.published ? "Published" : "Draft" }}
          </span>
        </div>
        <div class="flex-gap-sm topbar-actions">
          <p
            v-if="saveStatusLabel"
            class="save-status"
            :class="{
              'save-status--saving': saveStatusLabel === 'Saving…',
              'save-status--dirty': saveStatusLabel === 'Unsaved changes',
            }"
            aria-live="polite"
          >
            {{ saveStatusLabel }}
          </p>
          <button
            type="button"
            class="btn btn-ghost"
            :class="{ active: previewOnly }"
            @click="togglePreview"
          >
            {{ previewOnly ? "Editor" : "Preview" }}
          </button>
          <button type="button" class="btn btn-secondary" @click="cancelEdit">Cancel</button>
          <button
            v-if="canWriteReleases"
            type="button"
            class="btn btn-primary"
            :disabled="isUpdating"
            @click="saveEdit"
          >
            <span v-if="isUpdating">Saving…</span>
            <span v-else>{{ saveButtonLabel }}</span>
          </button>
        </div>
      </header>

      <main class="content-area">
        <div class="doc-shell" :class="{ 'preview-only': previewOnly }">
          <!-- Outline -->
          <div class="outline-pane">
            <div class="outline-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span class="outline-title">Article Outline</span>
            </div>
            <ul class="outline-tree" role="list">
              <li
                v-for="(h, idx) in editHeadings"
                :key="idx"
                :class="['outline-item', `level-${h.level}`, { active: activeHeading === h.text }]"
                role="listitem"
                tabindex="0"
                @click="scrollToHeading(h.text)"
                @keydown.enter="scrollToHeading(h.text)"
                @keydown.space.prevent="scrollToHeading(h.text)"
              >
                <span class="outline-marker" :class="{ 'level-h1': h.level === 1, 'level-h2': h.level === 2, 'level-h3': h.level === 3 }">H{{ h.level }}</span>
                <span class="outline-text">{{ h.text }}</span>
              </li>
              <li v-if="editHeadings.length === 0" class="outline-empty">
                <div class="outline-empty-content">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <span>No headings yet</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- Editor -->
          <div class="editor-pane">
            <div ref="paneBodyRef" class="pane-body">
              <template v-if="!previewOnly">
                <div v-if="editError" class="error-banner">{{ editError }}</div>
                <p v-if="canWriteReleases" class="edit-image-hint">
                  Type <kbd>/</kbd> and choose <strong>Upload image</strong>, click the
                  <strong>Upload image</strong> button on an image block, or paste from your clipboard.
                </p>
                <ClientOnly>
                  <EditorJs
                    v-model="editContent"
                    :read-only="!canWriteReleases"
                    :upload-image="uploadReleaseEditorImage"
                    placeholder="Write your release article content..."
                    style="height:100%;"
                  />
                </ClientOnly>
              </template>
              <template v-else>
                <header class="release-hero">
                  <div class="release-hero-date">{{ formatDate(release.releaseDate) }}</div>
                  <h1 class="release-hero-title">{{ formatReleaseHeading(release.appName, release.version, editDraft.heroTitle) }}</h1>
                  <div class="release-hero-meta">
                    <span class="release-hero-app">{{ release.appName }}</span>
                    <span v-if="release.version" class="pill pill-accent">{{ formatDisplayVersion(release.version) }}</span>
                  </div>
                </header>
                <MermaidHtml :html="previewHtml" class="preview-body" />
              </template>
            </div>
          </div>

          <!-- Right Sidebar (Properties + Versions tabs) -->
          <div v-if="!previewOnly" class="right-sidebar">
            <div class="sidebar-tabs">
              <button
                type="button"
                class="sidebar-tab"
                :class="{ active: rightSidebarTab === 'properties' }"
                @click="switchSidebarTab('properties')"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Properties
              </button>
              <button
                type="button"
                class="sidebar-tab"
                :class="{ active: rightSidebarTab === 'versions' }"
                @click="switchSidebarTab('versions')"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Versions
                <span v-if="releaseVersions.length > 0" class="tab-badge">{{ releaseVersions.length }}</span>
              </button>
            </div>

            <div class="sidebar-tab-panel">
              <Transition name="tab-fade" mode="out-in">
                <!-- Properties Panel -->
                <div v-if="rightSidebarTab === 'properties'" key="properties" class="props-panel">
                  <div class="props-section">
                    <div class="props-section-label">Release</div>
                    <div class="field">
                      <label for="releaseHeroTitle">Hero title</label>
                      <input
                        id="releaseHeroTitle"
                        v-model="editDraft.heroTitle"
                        class="input"
                        placeholder="e.g. Request tracing and deep health checks"
                        :disabled="!canWriteReleases"
                      />
                    </div>
                    <div class="field field-inline">
                      <label class="checkbox-label">
                        <input v-model="editDraft.published" type="checkbox" :disabled="!canWriteReleases" />
                        Published
                      </label>
                    </div>
                    <p class="field-hint">
                      Unpublished articles are hidden from the public release pages.
                    </p>
                  </div>

                  <div class="props-section">
                    <div class="props-section-label">Details</div>
                    <div class="field">
                      <label for="releaseApp">App</label>
                      <input id="releaseApp" class="input" :value="release.appName" readonly />
                    </div>
                    <div class="field-row">
                      <div class="field">
                        <label for="releaseVersion">Version</label>
                        <input
                          id="releaseVersion"
                          class="input num"
                          :value="release.version ? formatDisplayVersion(release.version) : '—'"
                          readonly
                        />
                      </div>
                      <div class="field">
                        <label for="releaseType">Type</label>
                        <input
                          id="releaseType"
                          class="input"
                          :value="release.type === 'article' ? 'Article' : 'Normal'"
                          readonly
                        />
                      </div>
                    </div>
                    <div class="field">
                      <label for="releaseDate">Release date</label>
                      <input id="releaseDate" class="input" :value="formatDate(release.releaseDate)" readonly />
                    </div>
                    <div class="field">
                      <label for="releaseModified">Last modified</label>
                      <input id="releaseModified" class="input num" :value="lastModified" readonly />
                    </div>
                  </div>
                </div>

                <!-- Versions Panel -->
                <div v-else key="versions" class="versions-panel">
                  <div v-if="isHistoryLoading" class="history-empty">Loading history…</div>
                  <div v-else-if="releaseVersions.length === 0" class="history-empty">
                    <p>No history yet</p>
                    <span class="meta-label">Save or publish to create history entries</span>
                  </div>
                  <div
                    v-for="item in releaseVersions"
                    :key="item.id"
                    class="history-item"
                  >
                    <div class="history-item-main">
                      <p class="history-preview">{{ previewReleaseContent(item.summary) }}</p>
                      <div class="history-meta-row">
                        <span class="history-time">{{ formatHistoryTime(item.createdAt) }}</span>
                        <span class="history-actor">{{ item.actor || "Unknown" }}</span>
                        <span class="pill" :class="getHistoryActionClass(item.action)">{{ getHistoryActionLabel(item.action) }}</span>
                      </div>
                    </div>
                    <div class="history-item-actions">
                      <button
                        v-if="releaseVersions.length > 1"
                        type="button"
                        class="btn btn-ghost btn-sm"
                        @click.stop="viewReleaseVersionDiff(item)"
                      >
                        View diff
                      </button>
                      <button
                        v-if="canWriteReleases"
                        type="button"
                        class="btn btn-ghost btn-sm"
                        @click.stop="restoreVersion(item)"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- ═══ VIEW MODE ═══ -->
    <div v-else class="release-content">
      <!-- Local topbar -->
      <header class="topbar">
        <div class="flex-gap-md">
          <h1>Release Notes</h1>
          <span class="pill pill-accent">{{ formatReleaseHeading(release.appName, release.version, release.heroTitle) }}</span>
          <span class="pill" :class="release.type === 'article' ? 'pill-purple' : 'pill-muted'">
            {{ release.type === 'article' ? 'Article' : 'Normal' }}
          </span>
        </div>
        <div class="flex-gap-sm">
          <NuxtLink to="/releases" class="btn btn-ghost btn-sm">All releases</NuxtLink>
          <NuxtLink
            v-if="release.type === 'normal' && release.versionId"
            :to="`/changelogs?versionId=${release.versionId}&history=1`"
            class="btn btn-ghost btn-sm"
          >
            View changelog history
          </NuxtLink>
          <NuxtLink v-if="release.type === 'normal' && release.versionId && canWriteChangelogs" :to="`/changelogs?versionId=${release.versionId}`" class="btn btn-secondary btn-sm">Edit changelog</NuxtLink>
          <template v-if="release.type === 'article'">
            <button type="button" class="btn btn-ghost btn-sm" @click="openReleaseHistory">Version history</button>
            <button v-if="canWriteReleases" type="button" class="btn btn-secondary btn-sm" @click="enterEditMode">Edit Release Article</button>
          </template>
          <button v-if="canWriteReleases" type="button" class="btn btn-danger btn-sm" @click="confirmDelete">Delete</button>
        </div>
      </header>

      <!-- Article layout -->
      <div class="article-layout">
        <article class="article-wrap">
          <!-- Hero -->
            <header class="release-hero">
              <div class="release-hero-date">{{ formatDate(release.releaseDate) }}</div>
              <h1 class="release-hero-title">{{ formatReleaseHeading(release.appName, release.version, release.heroTitle) }}</h1>
              <div class="release-hero-meta">
                <span class="release-hero-app">{{ release.appName }}</span>
                <span v-if="release.version" class="pill pill-accent">{{ formatDisplayVersion(release.version) }}</span>
                <NuxtLink :to="`/versions?app=${release.appId}`" class="text-muted-sm" style="text-decoration:underline;text-underline-offset:2px;">
                  View version timeline
                </NuxtLink>
              </div>
            </header>

            <!-- Article-only: Summary + Features + Media -->
            <template v-if="release.type === 'article'">
              <GeneralMarkdownReader
                v-if="release.summary"
                :content="release.summary"
                :extra-outline-items="featureOutlineItems"
                outline-title="Article Outline"
              />

              <!-- Features -->
              <section
                v-for="feature in release.features || []"
                :key="feature.id"
                :id="feature.id"
                class="feature-section"
              >
                <h2 class="feature-heading">{{ feature.heading }}</h2>
                <p class="feature-desc">{{ feature.description }}</p>

                <!-- Media -->
                <div
                  v-if="feature.media && feature.media.length > 0"
                  class="media-grid"
                  :class="feature.media.length === 2 ? 'media-grid-2' : feature.media.length >= 3 ? 'media-grid-3' : ''"
                >
                  <div
                    v-for="(m, idx) in feature.media"
                    :key="idx"
                    class="media-container"
                    :class="{ 'video-wrapper': m.type === 'video' && m.src, playing: playingMedia[mediaKey(feature.id, idx)] }"
                    @click="m.type === 'video' && m.src ? toggleVideo(mediaKey(feature.id, idx)) : undefined"
                  >
                    <!-- Video placeholder -->
                    <template v-if="m.type === 'video' && isMediaPlaceholder(m)">
                      <div class="media-placeholder-inner">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right:12px;opacity:.5;">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        {{ m.alt || "Video" }}
                      </div>
                      <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                    </template>

                    <!-- Video player -->
                    <template v-else-if="m.type === 'video' && m.src">
                      <video
                        :ref="(el) => { const k = mediaKey(feature.id, idx); if (el) videoEls.value[k] = el as HTMLVideoElement; else delete videoEls.value[k]; }"
                        :src="m.src"
                        preload="metadata"
                        playsinline
                        muted
                        loop
                        @click.stop
                      />
                      <div class="video-overlay">
                        <div class="play-btn">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                      <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                    </template>

                    <!-- Image placeholder -->
                    <template v-else-if="m.type === 'image' && isMediaPlaceholder(m)">
                      <div class="media-placeholder-inner">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right:12px;opacity:.5;">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        {{ m.alt || "Image" }}
                      </div>
                      <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                    </template>

                    <!-- Image -->
                    <template v-else>
                      <img :src="m.src" :alt="m.alt || ''" loading="lazy" />
                      <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                    </template>
                  </div>
                </div>
              </section>
            </template>

          <!-- Categories: shown for both normal and article -->
          <template v-if="release.categories">
            <div class="changes-section">
              <div class="changes-section-header">
                <h3 class="changes-section-title">Changelog</h3>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="copyChangelogToClipboard(
                    release.categories,
                    { version: release.version, appName: release.appName, releaseDate: release.releaseDate }
                  )"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
              </div>
              <section
                v-for="[key, items] in Object.entries(countCategories(release.categories)).filter(([, v]) => v.length > 0)"
                :key="key"
                :id="key"
                class="changes-subsection"
                :class="{ 'changes-section-compact': release.type === 'normal' }"
              >
                <h3 class="changes-heading">
                  <span class="pill" :class="categoryConfig[key]?.pillClass || 'pill-muted'">
                    {{ categoryConfig[key]?.label || key }}
                  </span>
                </h3>
                <ul class="changes-list">
                  <li v-for="(item, idx) in items" :key="idx" v-html="item" />
                </ul>
              </section>
            </div>
          </template>

          <!-- Prev / Next -->
          <nav class="release-footer-nav" aria-label="Release navigation">
            <NuxtLink v-if="adjacent.prev" :to="`/releases/${adjacent.prev.id}`" class="prev">
              <span class="label">Previous</span>
              <span class="version">{{ adjacent.prev.appName }} {{ adjacent.prev.version }}</span>
              <span class="date">{{ formatDate(adjacent.prev.releaseDate) }}</span>
            </NuxtLink>
            <div v-else />
            <NuxtLink v-if="adjacent.next" :to="`/releases/${adjacent.next.id}`" class="next">
              <span class="label">Next</span>
              <span class="version">{{ adjacent.next.appName }} {{ adjacent.next.version }}</span>
              <span class="date">{{ formatDate(adjacent.next.releaseDate) }}</span>
            </NuxtLink>
            <div v-else />
          </nav>
        </article>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="history-panel" :class="{ open: showHistoryPanel }" role="dialog" aria-modal="true" aria-label="Release version history" @click.self="closeReleaseHistory">
      <div class="history-drawer">
        <div class="history-header">
          <h3>Version history</h3>
          <button type="button" class="btn btn-ghost history-close" aria-label="Close version history" @click="closeReleaseHistory">✕</button>
        </div>
        <div class="history-list">
          <div v-if="isHistoryLoading" class="history-empty">Loading history…</div>
          <div v-else-if="releaseVersions.length === 0" class="history-empty">
            <p>No history yet</p>
            <span class="meta-label">Save or publish to create history entries</span>
          </div>
          <div
            v-for="item in releaseVersions"
            :key="item.id"
            class="history-item"
          >
            <div class="history-item-main">
              <p class="history-preview">{{ previewReleaseContent(item.summary) }}</p>
              <div class="history-meta-row">
                <span class="history-time">{{ formatHistoryTime(item.createdAt) }}</span>
                <span class="history-actor">{{ item.actor || "Unknown" }}</span>
                <span class="pill" :class="getHistoryActionClass(item.action)">{{ getHistoryActionLabel(item.action) }}</span>
              </div>
            </div>
            <div class="history-item-actions">
              <button
                v-if="releaseVersions.length > 1"
                type="button"
                class="btn btn-ghost btn-sm"
                @click.stop="viewReleaseVersionDiff(item)"
              >
                View diff
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DiffModal
      :open="diffOpen"
      title="Release diff"
      :diff="historyDiff"
      :is-loading="isDiffLoading"
      :error="diffError"
      :has-unsaved-changes="isEditing && hasEditChanges"
      @close="closeDiff"
      @update:from-id="onDiffFromChange"
      @update:to-id="onDiffToChange"
    />

    <!-- Restore Version Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: restoreConfirmVisible }" @click.self="cancelRestore">
      <div class="modal-panel" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Restore Version</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="cancelRestore">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Restore the article content from
            <strong>{{ formatHistoryTime(versionToRestore?.createdAt ?? null) }}</strong>?
            The current state will be saved to version history first.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="cancelRestore">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="isRestoring" @click="confirmRestore">
            <span v-if="isRestoring">Restoring…</span>
            <span v-else>Restore</span>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{ open: showDeleteModal }" @click.self="showDeleteModal = false">
      <div class="modal-panel" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Delete Release</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="showDeleteModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to delete the release for <strong>{{ release?.appName }} {{ release?.version }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Cancel</button>
          <button type="button" class="btn btn-danger" :disabled="isDeletingLocal || isDeleting" @click="doDelete">
            <span v-if="isDeletingLocal || isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══ Page layout ══════════════════════════════════════════════ */
.release-detail-page {
  width: 100%;
}

/* ═══ Topbar ═══════════════════════════════════════════════════ */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
}

/* ═══ Editor workspace (technical-editor layout) ═══════════════ */
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 93px);
  max-height: calc(100vh - 93px);
}

.editor-topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  margin: -32px -32px 0;
}
.editor-topbar h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}
.back-btn {
  padding: 6px;
}
.topbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.save-status {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.save-status--saving {
  color: var(--fg);
}
.save-status--dirty {
  color: oklch(55% 0.12 55);
}
.btn-ghost.active {
  background: var(--fg-soft);
  color: var(--fg);
}

.content-area {
  padding: 24px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.doc-shell {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.doc-shell.preview-only {
  grid-template-columns: 220px 1fr;
}
.doc-shell.preview-only .right-sidebar {
  display: none;
}
@media (max-width: 1100px) {
  .doc-shell {
    grid-template-columns: 1fr;
  }
  .doc-shell .outline-pane,
  .doc-shell .right-sidebar {
    display: none;
  }
}

.outline-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  max-height: 100%;
}
.outline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  flex-shrink: 0;
}
.outline-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}
.outline-tree {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.outline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: 2px solid transparent;
  margin-left: -2px;
}
.outline-item:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}
.outline-item:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.outline-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 500;
}
.outline-item.level-2 {
  padding-left: 20px;
}
.outline-item.level-3 {
  padding-left: 32px;
}
.outline-marker {
  font-size: 9px;
  font-weight: 600;
  font-family: var(--font-mono);
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--fg-soft);
  color: var(--muted);
  flex-shrink: 0;
  line-height: 1;
}
.outline-item.active .outline-marker {
  background: var(--accent);
  color: var(--surface);
}
.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.outline-empty {
  padding: 24px 8px;
}
.outline-empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.editor-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}
.editor-pane:has(.editor-js-wrapper) .pane-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.editor-pane:has(.editor-js-wrapper) .pane-body :deep(.editor-js-wrapper) {
  flex: 1;
  min-height: 0;
  overflow: visible;
}
.pane-body {
  flex: 1;
  padding: 16px;
  overflow: auto;
  min-height: 0;
}
.doc-shell.preview-only .editor-pane .pane-body {
  padding: 24px 32px;
}

.right-sidebar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 280px;
  min-height: 0;
  height: 100%;
  max-height: 100%;
}
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.sidebar-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  justify-content: center;
  position: relative;
}
.sidebar-tab:hover {
  color: var(--fg);
  background: var(--fg-soft);
}
.sidebar-tab:active {
  background: color-mix(in oklch, var(--fg-soft) 70%, transparent);
  transform: scale(0.98);
}
.sidebar-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--accent-soft);
}
.sidebar-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: var(--radius);
}
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--border);
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-mono);
  line-height: 1;
}
.sidebar-tab.active .tab-badge {
  background: var(--accent);
  color: var(--surface);
}
.sidebar-tab-panel {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.props-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.versions-panel {
  padding: 16px;
  overflow: auto;
}
.props-section {
  margin-bottom: 16px;
}
.props-section:last-of-type {
  margin-bottom: 0;
}
.props-section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 10px;
  padding-top: 4px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.field:last-child {
  margin-bottom: 0;
}
.field label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
.field-hint {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);
  margin: 0;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field-inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg);
  font-weight: 400;
  cursor: pointer;
}
.input,
.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 13px;
  color: var(--fg);
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.input:hover,
.select:hover {
  border-color: color-mix(in oklch, var(--fg) 30%, var(--border));
}
.input:focus,
.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: var(--surface);
}
.input[readonly] {
  cursor: default;
  opacity: 0.7;
}
.input[readonly]:hover {
  border-color: var(--border);
}
.input:disabled,
.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.block-editor {
  max-width: 720px;
}
.block-empty-state {
  padding: 40px;
  text-align: center;
  border: 2px dashed var(--border);
  border-radius: 12px;
  margin-bottom: 16px;
}
.block-card {
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.block-card.block-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px oklch(60% 0.1 250 / 0.15);
}
.block-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  border-radius: 10px 10px 0 0;
}
.block-type-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.block-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.block-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.block-action-btn:hover {
  background: var(--border);
  color: var(--text);
}
.block-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.block-action-danger:hover {
  background: oklch(95% 0.02 25);
  color: oklch(50% 0.15 25);
}
.block-content {
  padding: 12px;
}
.block-content input,
.block-content textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}
.block-content input:focus,
.block-content textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.block-heading-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-level-select {
  width: 60px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}
.block-heading-input {
  flex: 1;
}
.block-paragraph-textarea {
  min-height: 80px;
  resize: vertical;
}
.block-media-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block-media-form input {
  width: 100%;
}
.block-media-preview {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}
.block-media-preview img,
.block-media-preview video {
  max-width: 100%;
  border-radius: 6px;
}
.block-list-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.block-list-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-list-bullet {
  color: var(--accent);
  font-size: 16px;
  line-height: 1;
}
.block-list-row input {
  flex: 1;
}
.block-code-header {
  margin-bottom: 8px;
}
.block-code-lang {
  width: 180px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.block-code-textarea {
  min-height: 120px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}
.block-quote-textarea {
  min-height: 60px;
  border-left: 3px solid var(--accent);
  padding-left: 12px;
}
.block-divider-preview {
  text-align: center;
  padding: 16px;
  color: var(--muted);
  font-size: 18px;
  letter-spacing: 8px;
}
.add-block-area {
  margin-top: 12px;
  margin-bottom: 24px;
}
.add-block-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px;
  border: 2px dashed var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.add-block-trigger:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: oklch(60% 0.05 250 / 0.05);
}
.add-block-menu {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.add-block-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.add-block-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.add-block-option:hover {
  border-color: var(--accent);
  background: oklch(60% 0.05 250 / 0.05);
}
.add-block-icon {
  font-size: 20px;
  line-height: 1;
}
.add-block-label {
  font-size: 12px;
  font-weight: 500;
}
.add-block-cancel {
  display: block;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.add-block-cancel:hover {
  background: var(--border);
}
@media (max-width: 600px) {
  .add-block-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .block-heading-row {
    flex-direction: column;
    align-items: stretch;
  }
  .block-level-select {
    width: 100%;
  }
}
.edit-image-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.edit-image-hint kbd {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 11px;
}
.form-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  color: var(--fg);
}

.flex-gap-sm {
  display: flex;
  gap: 8px;
  align-items: center;
}
.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
}

.meta-label {
  font-size: 12px;
  color: var(--muted);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* ═══ Buttons ══════════════════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
  text-decoration: none;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--fg);
}
.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--fg);
}
.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
}
.btn-danger {
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}
.btn-danger:hover {
  background: oklch(50% 0.18 25);
}

/* ═══ Pills ════════════════════════════════════════════════════ */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.pill-amber {
  background: color-mix(in oklch, oklch(70% 0.14 85) 12%, transparent);
  color: oklch(55% 0.12 85);
}
.pill-red {
  background: color-mix(in oklch, oklch(60% 0.18 25) 12%, transparent);
  color: oklch(55% 0.14 25);
}
.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.16 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

/* ═══ Article layout ═════════════════════════════════════════ */
.article-layout {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.article-wrap {
  width: 100%;
  max-width: none;
}

/* Hero */
.release-hero {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.release-hero-date {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
}
.release-hero-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin-bottom: 16px;
  color: var(--fg);
}
.release-hero-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.release-hero-app {
  font-size: 14px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.release-hero-app::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

/* Article body (rendered markdown) */
.article-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  margin-bottom: 32px;
  max-width: 65ch;
}
.article-body > * {
  margin-bottom: 16px;
}
.article-body > *:last-child {
  margin-bottom: 0;
}
.article-body h2 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-top: 32px;
  margin-bottom: 16px;
  color: var(--fg);
}
.article-body h3 {
  font-size: 18px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 12px;
  color: var(--fg);
}
.article-body p {
  margin-bottom: 16px;
}
.article-body ul {
  margin-bottom: 16px;
  padding-left: 24px;
  list-style-type: disc;
}
.article-body ol {
  margin-bottom: 16px;
  padding-left: 24px;
  list-style-type: decimal;
}
.article-body li {
  margin-bottom: 6px;
}
.article-body blockquote {
  margin: 24px 0;
  padding: 12px 20px;
  border-left: 3px solid var(--accent);
  background: var(--bg);
  border-radius: 0 8px 8px 0;
  font-style: italic;
}
.article-body pre {
  margin: 24px 0;
  padding: 16px;
  background: var(--bg);
  border-radius: 8px;
  overflow-x: auto;
}
.article-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.article-body pre code {
  background: transparent;
  padding: 0;
}
.article-body img {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}
.article-body video {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}
.article-body hr {
  margin: 32px 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* ═══ Feature sections ═══════════════════════════════════════ */
.feature-section {
  margin: 48px 0;
  padding: 24px 0;
  border-top: 1px solid var(--border);
}
.feature-section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}
.feature-heading {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 16px;
  color: var(--fg);
}
.feature-desc {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  margin-bottom: 24px;
  max-width: 65ch;
}

/* ═══ Media system ═════════════════════════════════════════════ */
.media-container {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.media-container img,
.media-container video {
  width: 100%;
  display: block;
  aspect-ratio: 16/9;
  object-fit: cover;
}
.media-caption {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.media-placeholder-inner {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 14px;
  background: var(--bg);
}

/* Media grid */
.media-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}
.media-grid-2 {
  grid-template-columns: repeat(2, 1fr);
}
.media-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 640px) {
  .media-grid-2,
  .media-grid-3 {
    grid-template-columns: 1fr;
  }
}
.media-grid .media-container {
  margin-bottom: 0;
}
.media-grid .media-container img,
.media-grid .media-container video,
.media-grid .media-placeholder-inner {
  aspect-ratio: 4/3;
}

/* Video play overlay */
.video-wrapper {
  position: relative;
  cursor: pointer;
}
.video-wrapper video {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
}
.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--fg) 20%, transparent);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.video-wrapper.playing .video-overlay,
.video-wrapper:hover .video-overlay {
  opacity: 0;
}
.play-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 15%, transparent);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.play-btn:hover {
  transform: scale(1.05);
}
.play-btn svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
  margin-left: 4px;
}

/* ═══ Change categories ═══════════════════════════════════════ */
.changes-section {
  margin: 48px 0;
}
.changes-section:first-of-type {
  margin-top: 0;
}
.changes-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.changes-section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.changes-subsection {
  margin: 48px 0;
}
.changes-subsection:first-of-type {
  margin-top: 0;
}
.changes-section-compact {
  margin: 24px 0;
}
.changes-section-compact:first-of-type {
  margin-top: 0;
}
.changes-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
}
.changes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.changes-list li {
  padding: 10px 0;
  font-size: 15px;
  line-height: 1.6;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
  color: var(--fg);
}
.changes-list li:last-child {
  border-bottom: none;
}
.changes-list :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

/* ═══ Sticky nav ═══════════════════════════════════════════════ */
.release-nav {
  position: sticky;
  top: 24px;
  width: 200px;
  flex-shrink: 0;
  margin-left: 48px;
}
.release-nav-title {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
  margin-bottom: 12px;
}
.release-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.release-nav-list a {
  display: block;
  padding: 6px 0;
  font-size: 13px;
  color: var(--muted);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: 2px solid transparent;
  padding-left: 12px;
  margin-left: -12px;
  text-decoration: none;
}
.release-nav-list a:hover {
  color: var(--fg);
}
.release-nav-list a.active {
  color: var(--accent);
  font-weight: 500;
  border-left-color: var(--accent);
}

/* ═══ Prev / Next ══════════════════════════════════════════════ */
.release-footer-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.release-footer-nav a {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
}
.release-footer-nav a:hover {
  border-color: var(--fg);
  background: var(--surface);
}
.release-footer-nav a.next {
  text-align: right;
  align-items: flex-end;
}
.release-footer-nav .label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.release-footer-nav .version {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}
.release-footer-nav .date {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

/* ═══ Empty state ══════════════════════════════════════════════ */
.empty-state {
  padding: 64px 24px;
  text-align: center;
  color: var(--muted);
}
.empty-state p {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

/* ═══ Modal ══════════════════════════════════════════════════ */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.modal-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  transform: translateY(12px) scale(0.98);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open .modal-panel {
  transform: translateY(0) scale(1);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.modal-header h2 {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
  color: var(--fg);
}
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-size: 16px;
}
.modal-close:hover {
  color: var(--fg);
  border-color: var(--fg);
}
.modal-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.modal-body {
  padding: 20px 24px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.error-banner {
  background: color-mix(in oklch, oklch(55% 0.18 25) 8%, transparent);
  color: oklch(50% 0.16 25);
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  margin-bottom: 16px;
  border: 1px solid color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent);
}

/* ═══ Responsive ═══════════════════════════════════════════════ */
@media (max-width: 1024px) {
  .release-nav {
    display: none;
  }
}
@media (max-width: 768px) {
  .release-hero-title {
    font-size: 28px;
  }
  .release-footer-nav {
    grid-template-columns: 1fr;
  }
  .release-footer-nav a.next {
    text-align: left;
    align-items: flex-start;
  }
  .topbar {
    flex-wrap: wrap;
  }
  .editor-topbar {
    margin: -64px -20px 0 -64px;
    padding: 8px 20px;
    height: auto;
    min-height: 56px;
    flex-wrap: wrap;
  }
  .editor-page {
    height: auto;
    max-height: none;
  }
  .content-area {
    overflow: visible;
  }
  .doc-shell {
    overflow: visible;
  }
  .editor-pane {
    min-height: 480px;
  }
}
@media (max-width: 480px) {
  .editor-topbar {
    margin: -56px -16px 0 -56px;
    padding: 8px 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .media-container,
  .video-overlay,
  .play-btn,
  .release-footer-nav a,
  .release-nav-list a,
  .modal-overlay,
  .modal-panel,
  .outline-item,
  .sidebar-tab,
  .input,
  .select,
  .tab-fade-enter-active,
  .tab-fade-leave-active {
    transition: none !important;
  }
}

.history-panel {
  position: fixed;
  inset: 0;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  z-index: 1100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.history-panel.open {
  opacity: 1;
  pointer-events: auto;
}

.history-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: min(420px, 100%);
  height: 100%;
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}

.history-panel.open .history-drawer {
  transform: translateX(0);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
}

.history-list {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 10px;
}

.history-item-main {
  flex: 1;
  min-width: 0;
}

.history-preview {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--fg);
  line-height: 1.4;
}

.history-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.history-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
}

.history-item-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
