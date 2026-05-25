<script setup lang="ts">
import { nextTick } from "vue";
import { usePageStore } from "~/store/page";
import { renderMarkdown } from "~/composables/useMarkdown";
import type { AppVersion } from "~/composables/useApps";

definePageMeta({
  auth: true,
});

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const { apps, fetchApps } = useApps();
const { versions, fetchVersions, updateVersion } = useVersions();
const { createRelease, fetchReleases, updateRelease } = useReleases();
const releasesForVersion = ref<{ normal?: { id: string }; article?: { id: string } }>({});

onBeforeMount(() => {
  $page.setTitle("Changelog Editor");
});

// ── Version state ──────────────────────────────────────────────
const currentVersion = ref<AppVersion | null>(null);

// Use shared store selection with localStorage persistence
$page.hydrateSelection();
const selectedAppId = computed({
  get: () => $page.selectedAppId,
  set: (val: string) => $page.setSelectedAppId(val)
});
const selectedVersionId = computed({
  get: () => $page.selectedVersionId,
  set: (val: string) => $page.setSelectedVersionId(val)
});

// ── Editor state ───────────────────────────────────────────────
const content = ref("");
const status = ref<"draft" | "published">("draft");
const previewOnly = ref(false);
const hasChanges = ref(false);
const lastSavedAt = ref<Date | null>(null);
const isUpdating = ref(false);

// ── Search ─────────────────────────────────────────────────────
const editorSearch = ref("");

// ── History panel ────────────────────────────────────────────────
const showHistoryPanel = ref(false);
const historySearch = ref("");
const historyFocusIndex = ref(0);
let lastFocusedElement: HTMLElement | null = null;

// ── Release panel ───────────────────────────────────────────────
const showReleasePanel = ref(false);
const heroTitle = ref("");
const featureHeading = ref("");
const featureDesc = ref("");

// ── Init ─────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchApps();

  const queryVersionId = route.query.versionId as string | undefined;
  const queryAppId = route.query.app as string | undefined;
  const persistedAppId = $page.selectedAppId;

  // Restore selection: URL param > persisted store > first app
  if (queryAppId && apps.value.find((a) => a.id === queryAppId)) {
    selectedAppId.value = queryAppId;
  } else if (persistedAppId && apps.value.find((a) => a.id === persistedAppId)) {
    selectedAppId.value = persistedAppId;
  } else if (apps.value.length > 0) {
    selectedAppId.value = apps.value[0].id;
  }

  if (selectedAppId.value) {
    await fetchVersions(selectedAppId.value);

    const persistedVersionId = $page.selectedVersionId;
    if (queryVersionId && versions.value.find((v) => v.id === queryVersionId)) {
      selectedVersionId.value = queryVersionId;
    } else if (persistedVersionId && versions.value.find((v) => v.id === persistedVersionId)) {
      selectedVersionId.value = persistedVersionId;
    } else if (versions.value.length > 0) {
      selectedVersionId.value = versions.value[0].id;
    }
  }

  if (selectedVersionId.value) {
    await loadVersion(selectedVersionId.value);
    await checkExistingRelease(selectedVersionId.value);
  }

  syncUrlQuery();
});

async function loadVersion(versionId: string) {
  const version = versions.value.find((v) => v.id === versionId);
  if (!version) return;

  currentVersion.value = version;
  content.value = version.releaseNotes || "";
  status.value = version.status === "published" ? "published" : "draft";
  hasChanges.value = false;
  lastSavedAt.value = version.updatedAt ? new Date(version.updatedAt) : new Date();
}

watch([content, status], () => {
  hasChanges.value = true;
});

// ── Dropdown options ─────────────────────────────────────────────
const appOptions = computed(() =>
  apps.value.map((a) => ({ id: a.id, label: a.name }))
);

const versionOptions = computed(() =>
  versions.value.map((v) => ({ id: v.id, label: v.version }))
);

function syncUrlQuery() {
  const query: Record<string, string> = {};
  if (selectedAppId.value) query.app = selectedAppId.value;
  if (selectedVersionId.value) query.versionId = selectedVersionId.value;
  router.replace({ path: "/changelogs", query });
}

watch(selectedAppId, async (newAppId, oldAppId) => {
  if (!newAppId) return;
  await fetchVersions(newAppId);
  if (versions.value.length > 0) {
    const stillExists = versions.value.find((v) => v.id === selectedVersionId.value);
    if (!stillExists) {
      selectedVersionId.value = versions.value[0].id;
    } else if (oldAppId !== newAppId) {
      // Version id stayed the same but app changed; still need to sync URL
      syncUrlQuery();
    }
  } else {
    selectedVersionId.value = "";
    currentVersion.value = null;
    content.value = "";
    syncUrlQuery();
  }
});

watch(selectedVersionId, async (newVersionId) => {
  if (!newVersionId || newVersionId === currentVersion.value?.id) return;
  await loadVersion(newVersionId);
  await checkExistingRelease(newVersionId);
  syncUrlQuery();
});

async function checkExistingRelease(versionId: string) {
  try {
    const data = await $fetch<{ data: Array<{ id: string; type: string }> }>("/api/releases", {
      query: { version: versionId, limit: "10" },
    });
    const map: { normal?: { id: string }; article?: { id: string } } = {};
    for (const r of data.data) {
      if (r.type === "normal") map.normal = { id: r.id };
      if (r.type === "article") map.article = { id: r.id };
    }
    releasesForVersion.value = map;
  } catch {
    releasesForVersion.value = {};
  }
}

const saveStatusLabel = computed(() => {
  if (hasChanges.value) return "Unsaved changes";
  if (!lastSavedAt.value) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - lastSavedAt.value.getTime()) / 1000);
  if (diff < 60) return "Auto-saved just now";
  if (diff < 3600) return `Auto-saved ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Auto-saved ${Math.floor(diff / 3600)}h ago`;
  return "Auto-saved";
});

// ── Markdown preview ─────────────────────────────────────────────
const renderedPreview = computed(() => renderMarkdown(content.value));

// ── Toolbar helpers ────────────────────────────────────────────
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function wrapText(before: string, after?: string) {
  const textarea = textareaRef.value;
  if (!textarea) return;
  after = after || before;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end);
  const replacement = before + selected + after;
  textarea.setRangeText(replacement, start, end, "end");
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  content.value = textarea.value;
}

function insertLine(prefix: string) {
  const textarea = textareaRef.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const text = textarea.value;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  textarea.setRangeText(prefix, lineStart, lineStart, "end");
  textarea.focus();
  textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
  content.value = textarea.value;
}

function togglePreview() {
  previewOnly.value = !previewOnly.value;
}

// ── Save / Publish ─────────────────────────────────────────────
async function syncReleasesFromChangelog() {
  if (!currentVersion.value || !releasesForVersion.value) return;
  try {
    const categories = parseChangelogToCategories(content.value);
    const summary = content.value.slice(0, 500);
    const releases = releasesForVersion.value;
    // Only sync the NORMAL release from markdown changelog edits.
    // Article releases have their own rich content (hero, features, media)
    // and should NOT be overwritten by markdown saves.
    if (releases.normal?.id) {
      await updateRelease(releases.normal.id, { categories, summary });
    }
  } catch {
    // Silently ignore sync failures; the version save is the primary action
  }
}

async function saveDraft() {
  if (!currentVersion.value) return;
  isUpdating.value = true;
  try {
    await updateVersion(currentVersion.value.appId, currentVersion.value.id, {
      releaseNotes: content.value,
    });
    await createHistorySnapshot(currentVersion.value.id, content.value, "save");
    await syncReleasesFromChangelog();
    hasChanges.value = false;
    lastSavedAt.value = new Date();
  } finally {
    isUpdating.value = false;
  }
}

async function publishChangelog() {
  if (!currentVersion.value) return;
  isUpdating.value = true;
  try {
    await updateVersion(currentVersion.value.appId, currentVersion.value.id, {
      releaseNotes: content.value,
      status: "published",
    });
    await createHistorySnapshot(currentVersion.value.id, content.value, "publish");
    await syncReleasesFromChangelog();
    status.value = "published";
    hasChanges.value = false;
    lastSavedAt.value = new Date();
  } finally {
    isUpdating.value = false;
  }
}

async function createHistorySnapshot(versionId: string, snapshotContent: string, action: string) {
  try {
    await $fetch(`/api/versions/${versionId}/history`, {
      method: "POST",
      body: { versionId, content: snapshotContent, action },
    });
  } catch {
    // Silently fail; history is non-critical
  }
}

// ── History panel ──────────────────────────────────────────────
function openHistory() {
  lastFocusedElement = document.activeElement as HTMLElement;
  showHistoryPanel.value = true;
  document.body.style.overflow = "hidden";
  fetchHistory();
  nextTick(() => {
    const searchInput = document.querySelector<HTMLInputElement>(".history-search");
    if (searchInput) searchInput.focus();
  });
}

function closeHistory() {
  showHistoryPanel.value = false;
  document.body.style.overflow = "";
  if (lastFocusedElement) {
    nextTick(() => lastFocusedElement?.focus());
  }
}

function focusHistoryItem(index: number) {
  const items = filteredHistory.value;
  if (items.length === 0) return;
  historyFocusIndex.value = Math.max(0, Math.min(index, items.length - 1));
  const el = document.querySelectorAll(".history-item")[historyFocusIndex.value] as HTMLElement;
  if (el) el.focus();
}

function onHistoryListKeydown(e: KeyboardEvent) {
  const items = filteredHistory.value;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    focusHistoryItem(historyFocusIndex.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    focusHistoryItem(historyFocusIndex.value - 1);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const activeItem = items[historyFocusIndex.value];
    if (activeItem) restoreHistoryItem(activeItem);
  }
}

function onHistoryPanelKeydown(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const panel = document.querySelector(".history-panel.open");
  if (!panel) return;
  const focusable = panel.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ── Release panel ──────────────────────────────────────────────
function openReleasePanel() {
  lastFocusedElement = document.activeElement as HTMLElement;
  showReleasePanel.value = true;
  document.body.style.overflow = "hidden";
  parseChangelogCategories();
  nextTick(() => {
    const heroInput = document.getElementById("heroTitle") as HTMLInputElement;
    if (heroInput) heroInput.focus();
  });
}

function closeReleasePanel() {
  showReleasePanel.value = false;
  document.body.style.overflow = "";
  if (lastFocusedElement) {
    nextTick(() => lastFocusedElement?.focus());
  }
}

function onReleasePanelKeydown(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const panel = document.querySelector(".release-panel.open");
  if (!panel) return;
  const focusable = panel.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

const releaseCategories = ref<Array<{ label: string; checked: boolean; colorClass: string }>>([]);

function parseChangelogCategories() {
  const text = content.value;
  const cats: Array<{ label: string; checked: boolean; colorClass: string }> = [];
  const seen = new Set<string>();
  const regex = /^###\s+(Added|Fixed|Changed|Deprecated|Security)/gim;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const label = match[1];
    if (!seen.has(label)) {
      seen.add(label);
      const colorClass =
        label === "Added" ? "pill-green" :
        label === "Fixed" ? "pill-blue" :
        label === "Changed" ? "pill-amber" :
        label === "Deprecated" ? "pill-purple" : "pill-red";
      cats.push({ label, checked: true, colorClass });
    }
  }
  releaseCategories.value = cats;
  // Auto-suggest hero title from first h2
  const h2Match = text.match(/^##\s+\[?([^\n\]]+)/m);
  if (h2Match && !heroTitle.value) {
    heroTitle.value = h2Match[1].trim();
  }
}

const releasePreviewHtml = computed(() => {
  const title = heroTitle.value.trim();
  if (!title) {
    return '<p style="color:var(--muted);">Enter a headline to see preview</p>';
  }
  let html = `<h4>Release Preview</h4><p style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(title)}</p>`;
  if (featureHeading.value) {
    html += `<p style="font-weight:600;margin:16px 0 4px;">${escapeHtml(featureHeading.value)}</p>`;
    if (featureDesc.value) html += `<p style="color:var(--muted);margin:0 0 12px;">${escapeHtml(featureDesc.value)}</p>`;
  }
  const checkedCats = releaseCategories.value.filter((c) => c.checked);
  if (checkedCats.length > 0) {
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">${checkedCats.map((c) => `<span class="pill ${c.colorClass}">${escapeHtml(c.label)}</span>`).join("")}</div>`;
  }
  return html;
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Parse changelog markdown into release categories ────────────
function parseChangelogToCategories(text: string): Record<string, string[]> {
  const categories: Record<string, string[]> = {};
  const lines = text.split("\n");
  let currentCategory: string | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(Added|Fixed|Changed|Deprecated|Security)/i);
    if (headerMatch) {
      currentCategory = headerMatch[1].toLowerCase();
      if (!categories[currentCategory]) {
        categories[currentCategory] = [];
      }
      continue;
    }

    if (currentCategory) {
      const itemMatch = line.match(/^-\s+(.+)$/);
      if (itemMatch) {
        categories[currentCategory].push(itemMatch[1].trim());
      }
    }
  }

  return categories;
}

const isPublishingRelease = ref(false);

async function submitQuickRelease() {
  if (!currentVersion.value || !selectedAppId.value || isPublishingRelease.value) return;

  isPublishingRelease.value = true;
  try {
    const categories = parseChangelogToCategories(content.value);
    const release = await createRelease({
      appId: selectedAppId.value,
      versionId: currentVersion.value.id,
      heroTitle: `${apps.value.find((a) => a.id === selectedAppId.value)?.name || "Release"} ${currentVersion.value.version}`,
      summary: content.value.slice(0, 500),
      categories,
      type: "normal",
      published: true,
    });

    if (release?.id) {
      await checkExistingRelease(currentVersion.value.id);
      await navigateTo(`/releases/${release.id}`);
    }
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.existingReleaseId) {
      await navigateTo(`/releases/${e.data.existingReleaseId}`);
    }
    if (e?.statusCode !== 409) throw e;
  } finally {
    isPublishingRelease.value = false;
  }
}

async function submitPublishRelease() {
  if (!currentVersion.value || !selectedAppId.value || isPublishingRelease.value) return;

  isPublishingRelease.value = true;
  try {
    // Parse categories from markdown
    const categories = parseChangelogToCategories(content.value);

    // Build features from feature highlights if provided
    const features: Array<{ id: string; heading: string; description: string }> = [];
    if (featureHeading.value.trim()) {
      features.push({
        id: crypto.randomUUID(),
        heading: featureHeading.value.trim(),
        description: featureDesc.value.trim(),
      });
    }

    const release = await createRelease({
      appId: selectedAppId.value,
      versionId: currentVersion.value.id,
      heroTitle: heroTitle.value.trim() || content.value.split("\n")[0].slice(0, 120),
      summary: content.value.slice(0, 500),
      features: features.length > 0 ? features : undefined,
      categories,
      type: "article",
      published: true,
    });

    closeReleasePanel();

    // Navigate to the newly created release
    if (release?.id) {
      await navigateTo(`/releases/${release.id}`);
    }
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.existingReleaseId) {
      closeReleasePanel();
      await navigateTo(`/releases/${e.data.existingReleaseId}`);
    }
    // Other errors are already toasted by createRelease; just re-throw non-409s
    if (e?.statusCode !== 409) throw e;
  } finally {
    isPublishingRelease.value = false;
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveDraft();
  }
  if (e.key === "Escape") {
    if (showHistoryPanel.value) closeHistory();
    if (showReleasePanel.value) closeReleasePanel();
  }
  if (showHistoryPanel.value) onHistoryPanelKeydown(e);
  if (showReleasePanel.value) onReleasePanelKeydown(e);
}

// ── History data ────────────────────────────────────────────
const historyItems = ref<Array<{ id: string; versionId: string; content: string; action: string; actor: string | null; createdAt: string | null }>>([]);
const isHistoryLoading = ref(false);

async function fetchHistory() {
  if (!currentVersion.value) return;
  isHistoryLoading.value = true;
  try {
    const data = await $fetch<{ data: Array<{ id: string; versionId: string; content: string; action: string; actor: string | null; createdAt: string | null }> }>(`/api/versions/${currentVersion.value.id}/history`, {
      query: { limit: "20" },
    });
    historyItems.value = data.data;
  } catch {
    historyItems.value = [];
  } finally {
    isHistoryLoading.value = false;
  }
}

const filteredHistory = computed(() => {
  const q = historySearch.value.toLowerCase().trim();
  if (!q) return historyItems.value;
  return historyItems.value.filter(
    (h) =>
      (h.actor || "").toLowerCase().includes(q) ||
      (h.action || "").toLowerCase().includes(q)
  );
});

function restoreHistoryItem(item: (typeof historyItems.value)[0]) {
  content.value = item.content;
  hasChanges.value = true;
  closeHistory();
}
</script>

<template>
  <div class="changelog-editor-page" @keydown="onKeydown" tabindex="-1">
    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-title-group">
        <h1>Changelog Editor</h1>
        <span v-if="currentVersion" class="pill pill-blue">
          {{ currentVersion.appName || apps.find((a) => a.id === currentVersion?.appId)?.name || "" }} {{ currentVersion.version }}
        </span>
      </div>
      <div class="topbar-actions">
        <div class="selector-group">
          <span class="selector-label">App</span>
          <GeneralSearchableDropdown
            v-model="selectedAppId"
            :options="appOptions"
            placeholder="Select app…"
            search-placeholder="Search apps…"
          />
        </div>
        <div class="selector-connector" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </div>
        <div class="selector-group" :class="{ 'selector-disabled': !selectedAppId || versions.length === 0 }">
          <div class="selector-label-row">
            <span class="selector-label">Version</span>
            <NuxtLink v-if="selectedAppId && versions.length === 0" to="/versions" class="selector-inline-hint">
              No versions. Add one
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </NuxtLink>
          </div>
          <GeneralSearchableDropdown
            v-model="selectedVersionId"
            :options="versionOptions"
            placeholder="Select version…"
            search-placeholder="Search versions…"
          />
        </div>
        <div class="release-actions">
          <button
            v-if="releasesForVersion.normal"
            type="button"
            class="btn btn-sm btn-secondary"
            @click="navigateTo(`/releases/${releasesForVersion.normal.id}`)"
          >
            View Normal
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-secondary"
            :disabled="!currentVersion || isPublishingRelease"
            @click="submitQuickRelease"
          >
            {{ isPublishingRelease ? "Creating…" : "Quick Release" }}
          </button>
          <button
            v-if="releasesForVersion.article"
            type="button"
            class="btn btn-sm btn-primary"
            @click="navigateTo(`/releases/${releasesForVersion.article.id}`)"
          >
            Edit Article
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!currentVersion || isPublishingRelease"
            @click="openReleasePanel"
          >
            Create Article
          </button>
        </div>
      </div>
    </header>

    <!-- Editor meta bar -->
    <div class="row-between" style="margin-bottom:16px;">
      <div class="flex-gap-md">
        <span class="text-muted-sm">CHANGELOG.md</span>
        <span class="pill" :class="status === 'published' ? 'pill-green' : 'pill-blue'">
          {{ status === 'published' ? 'Published' : 'Draft' }}
        </span>
        <span v-if="saveStatusLabel" class="pill" :class="hasChanges ? 'pill-amber' : 'pill-green'">{{ saveStatusLabel }}</span>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="isUpdating || !currentVersion" @click="saveDraft">
          {{ isUpdating ? "Saving…" : "Save" }}
        </button>
      </div>
      <div class="flex-gap-sm">
        <input
          v-model="editorSearch"
          class="search search-changelog"
          placeholder="Search changelog…"
          aria-label="Search changelog content"
        />
        <button type="button" class="btn btn-ghost btn-sm" @click="togglePreview">
          {{ previewOnly ? "Editor" : "Preview" }}
        </button>
        <button type="button" class="btn btn-ghost btn-sm" @click="openHistory">
          History
        </button>
      </div>
    </div>

    <!-- Empty state: onboarding for new users -->
    <div v-if="!currentVersion" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </div>

        <h2 class="empty-state-title">Changelog Editor</h2>
        <p class="empty-state-desc">
          Write structured release notes for each app version. Changelogs use category headers
          so you can publish formatted release notes with one click.
        </p>

        <div class="empty-state-example">
          <div class="example-header">Expected format</div>
          <pre class="example-code">### Added
- New webhook retry logic with exponential backoff
- Dark mode support for dashboard

### Fixed
- Resolved timeout on large file uploads
- Corrected version sorting in API response

### Changed
- Updated rate limits for enterprise plans</pre>
        </div>

        <div class="empty-state-workflow">
          <div class="workflow-step">
            <span class="workflow-num">1</span>
            <span class="workflow-label">Select app</span>
          </div>
          <div class="workflow-connector" />
          <div class="workflow-step">
            <span class="workflow-num">2</span>
            <span class="workflow-label">Pick version</span>
          </div>
          <div class="workflow-connector" />
          <div class="workflow-step">
            <span class="workflow-num">3</span>
            <span class="workflow-label">Write changelog</span>
          </div>
          <div class="workflow-connector" />
          <div class="workflow-step">
            <span class="workflow-num">4</span>
            <span class="workflow-label">Create release</span>
          </div>
        </div>

        <div class="empty-state-cta">
          <p v-if="apps.length === 0" class="cta-hint">
            No apps yet. <NuxtLink to="/apps" class="cta-link">Create your first app</NuxtLink> to get started.
          </p>
          <p v-else-if="selectedAppId && versions.length === 0" class="cta-hint">
            This app has no versions. <NuxtLink to="/versions" class="cta-link">Add a version</NuxtLink> first.
          </p>
          <p v-else class="cta-hint">Select an app and version from the top bar to start editing.</p>
        </div>
      </div>
    </div>

    <!-- Editor shell -->
    <div v-else class="editor-shell" :class="{ 'preview-only': previewOnly }">
      <!-- Editor -->
      <div class="editor-pane">
        <div class="format-hint" v-if="!content.trim()">
          <span class="format-hint-label">Changelog categories:</span>
          <div class="format-hint-tags">
            <span class="format-hint-tag">### Added</span>
            <span class="format-hint-tag">### Fixed</span>
            <span class="format-hint-tag">### Changed</span>
            <span class="format-hint-tag">### Deprecated</span>
            <span class="format-hint-tag">### Security</span>
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="tool-btn" @click="wrapText('## ')">H2</button>
          <button type="button" class="tool-btn" @click="wrapText('### ')">H3</button>
          <button type="button" class="tool-btn" @click="wrapText('**','**')">B</button>
          <button type="button" class="tool-btn" @click="wrapText('*','*')">I</button>
          <button type="button" class="tool-btn" @click="wrapText('`','`')">`code`</button>
          <button type="button" class="tool-btn" @click="insertLine('- ')">• list</button>
          <button type="button" class="tool-btn" @click="insertLine('1. ')">1. list</button>
          <button type="button" class="tool-btn" @click="insertLine('- [ ] ')">[] task</button>
          <button type="button" class="tool-btn" @click="wrapText('[',']()')">link</button>
          <button type="button" class="tool-btn" @click="insertLine('> ')">quote</button>
        </div>
        <div class="pane-body">
          <textarea
            ref="textareaRef"
            v-model="content"
            class="textarea"
            spellcheck="false"
            placeholder="Enter changelog markdown…"
          />
        </div>
      </div>

      <!-- Preview -->
      <div class="editor-pane">
        <div class="pane-header">
          <span>Preview</span>
          <span class="meta-label">Rendered from markdown</span>
        </div>
        <div class="pane-body preview-body" v-html="renderedPreview" />
      </div>
    </div>

    <!-- History Panel -->
    <div class="history-panel" :class="{ open: showHistoryPanel }" role="dialog" aria-modal="true" aria-labelledby="historyTitle" tabindex="-1" @click.self="closeHistory">
      <div class="history-drawer">
        <div class="history-header">
          <h3 id="historyTitle">Version history</h3>
          <button type="button" class="btn btn-ghost history-close" aria-label="Close version history" @click="closeHistory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="history-search-wrap">
          <input v-model="historySearch" type="search" class="history-search" placeholder="Filter by author or action…" aria-label="Filter version history" />
        </div>
        <div class="history-list" role="list" @keydown="onHistoryListKeydown">
          <div
            v-for="(item, index) in filteredHistory"
            :key="item.id"
            class="history-item"
            role="listitem"
            tabindex="0"
            @click="historyFocusIndex = index"
            @keydown.enter.prevent="restoreHistoryItem(item)"
            @keydown.space.prevent="restoreHistoryItem(item)"
          >
            <div class="history-item-main">
              <div class="time">{{ item.createdAt ? new Date(item.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" }}</div>
              <div class="history-meta-row">
                <span class="author">{{ item.actor || "Unknown" }}</span>
                <span class="pill" :class="item.action === 'publish' ? 'pill-green' : 'pill-muted'">{{ item.action }}</span>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm history-restore" @click.stop="restoreHistoryItem(item)">
              Restore
            </button>
          </div>
          <div v-if="isHistoryLoading" class="history-empty">
            <p>Loading history…</p>
          </div>
          <div v-else-if="filteredHistory.length === 0" class="history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" aria-hidden="true"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            <p>No history yet</p>
            <span class="text-muted-sm">Save or publish to create history entries</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Release Panel -->
    <div class="release-panel" :class="{ open: showReleasePanel }" role="dialog" aria-modal="true" aria-labelledby="releaseTitle" tabindex="-1" @click.self="closeReleasePanel">
      <div class="release-drawer">
        <div class="release-header">
          <h3 id="releaseTitle">Create Article Release</h3>
          <button type="button" class="btn btn-ghost release-close" aria-label="Close release panel" @click="closeReleasePanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="release-body">
          <div class="release-section">
            <div class="release-section-title">Headline</div>
            <input id="heroTitle" v-model="heroTitle" type="text" class="release-input" placeholder="e.g. Request tracing, deep health checks, and retry reliability" />
          </div>
          <div class="release-section">
            <div class="release-section-title">Feature Highlights</div>
            <input v-model="featureHeading" type="text" class="release-input" placeholder="Feature heading (optional)" />
            <textarea v-model="featureDesc" class="release-textarea" placeholder="Describe the feature for the release article…" />
          </div>
          <div class="release-section">
            <div class="release-section-title">Categories from Changelog</div>
            <div class="release-categories">
              <label v-for="cat in releaseCategories" :key="cat.label" class="release-cat-tag">
                <input v-model="cat.checked" type="checkbox" />
                <span class="pill" :class="cat.colorClass">{{ cat.label }}</span>
              </label>
              <span v-if="releaseCategories.length === 0" class="meta-label">No categories detected</span>
            </div>
          </div>
          <div class="release-section">
            <div class="release-section-title">Preview</div>
            <div class="release-preview-box" v-html="releasePreviewHtml" />
          </div>
        </div>
        <div class="release-footer">
          <button type="button" class="btn btn-secondary" @click="closeReleasePanel">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="isPublishingRelease || !currentVersion" @click="submitPublishRelease">
            <span v-if="isPublishingRelease">Publishing…</span>
            <span v-else>Publish Article</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.changelog-editor-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  outline: none;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
  white-space: nowrap;
}
.topbar-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.topbar-actions {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

/* App/Version selectors */
.selector-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}
.selector-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding-left: 2px;
}
.selector-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.selector-connector {
  color: var(--border);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  align-self: center;
}
.selector-disabled {
  opacity: 0.5;
}
.selector-disabled .selector-inline-hint {
  opacity: 1;
}
.selector-inline-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}
.selector-inline-hint:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.selector-inline-hint svg {
  flex-shrink: 0;
}

.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.select:focus {
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
  border-color: var(--accent);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}
.flex-gap-sm {
  display: flex;
  gap: 8px;
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

.search {
  width: 240px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.search:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}
.search-changelog {
  width: 200px;
}

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
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}

.editor-shell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
.editor-shell.preview-only {
  grid-template-columns: 1fr;
}
.editor-shell.preview-only .editor-pane:first-child {
  display: none;
}
@media (max-width: 960px) {
  .editor-shell {
    grid-template-columns: 1fr;
  }
}

.editor-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
  flex-shrink: 0;
}
.pane-body {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.tool-btn {
  padding: 6px 8px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.tool-btn:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.tool-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.textarea {
  width: 100%;
  height: 100%;
  border: none;
  resize: none;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  background: transparent;
  outline: none;
}

.preview-body {
  font-size: 14px;
  line-height: 1.6;
}
.preview-body :deep(h1) {
  font-size: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}
.preview-body :deep(h2) {
  font-size: 18px;
  margin: 24px 0 12px;
  font-weight: 600;
}
.preview-body :deep(h3) {
  font-size: 16px;
  margin: 20px 0 10px;
  font-weight: 600;
}
.preview-body :deep(ul) {
  padding-left: 20px;
  margin: 8px 0;
}
.preview-body :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}
.preview-body :deep(li) {
  margin: 4px 0;
}
.preview-body :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}
.preview-body :deep(pre) {
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  overflow: auto;
  margin: 8px 0;
}
.preview-body :deep(pre code) {
  background: none;
  padding: 0;
}
.preview-body :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--muted);
}
.preview-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}
.preview-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}
.preview-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 14px;
}
.preview-body :deep(th),
.preview-body :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.preview-body :deep(th) {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-label {
  font-size: 12px;
  color: var(--muted);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
  color: var(--fg);
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
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--fg);
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--fg);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-sm {
  padding: 5px 12px;
  font-size: 13px;
}

.release-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
  margin-left: 4px;
}

/* History panel */
.history-panel {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.history-panel.open {
  opacity: 1;
  pointer-events: auto;
}
.history-drawer {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
  flex-shrink: 0;
}
.history-header h3 {
  font-size: 16px;
  margin: 0;
}
.history-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius);
}
.history-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.history-search-wrap {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.history-search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.history-search:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
}
.history-item:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}
.history-item:hover {
  background: var(--fg-soft);
}
.history-item:hover .history-restore {
  opacity: 1;
}
.history-item-main {
  flex: 1;
  min-width: 0;
}
.history-item .time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.history-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.history-item .author {
  font-size: 13px;
  color: var(--fg);
}
.history-restore {
  opacity: 0;
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--muted);
  text-align: center;
}
.history-empty svg {
  color: var(--border);
}
.history-empty p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
}

/* Release panel */
.release-panel {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.release-panel.open {
  opacity: 1;
  pointer-events: auto;
}
.release-drawer {
  width: 520px;
  max-width: 90vw;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.release-panel.open .release-drawer {
  transform: translateX(0);
}
.release-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.release-header h3 {
  font-size: 16px;
  margin: 0;
}
.release-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius);
}
.release-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.release-section {
  margin-bottom: 24px;
}
.release-section-title {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
  margin-bottom: 12px;
}
.release-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  margin-bottom: 12px;
}
.release-input:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}
.release-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  line-height: 1.5;
  resize: vertical;
}
.release-textarea:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}
.release-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.release-cat-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--fg);
  background: var(--bg);
  cursor: pointer;
}
.release-cat-tag input {
  margin: 0;
}
.release-preview-box {
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 14px;
  line-height: 1.5;
}
.release-preview-box :deep(h4) {
  font-size: 14px;
  margin: 0 0 8px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.release-preview-box :deep(p) {
  margin: 0 0 12px;
}
.release-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.16 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.pill-red {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(50% 0.14 25);
}

/* Empty state / onboarding */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  overflow-y: auto;
}
.empty-state-content {
  max-width: 560px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.empty-state-icon {
  color: var(--border);
  margin-bottom: 4px;
}
.empty-state-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
}
.empty-state-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0;
  max-width: 440px;
}
.empty-state-example {
  width: 100%;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 4px;
}
.example-header {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.example-code {
  padding: 16px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--fg);
  background: transparent;
  overflow-x: auto;
}
.empty-state-workflow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.workflow-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--fg);
}
.workflow-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
}
.workflow-connector {
  width: 16px;
  height: 1px;
  background: var(--border);
  flex-shrink: 0;
}
.empty-state-cta {
  margin-top: 4px;
}
.cta-hint {
  font-size: 14px;
  color: var(--muted);
  margin: 0;
}
.cta-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 500;
}
.cta-link:hover {
  color: color-mix(in oklch, var(--accent) 88%, black);
}

/* Editor format hint */
.format-hint {
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.format-hint-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
.format-hint-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.format-hint-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .history-panel,
  .history-drawer,
  .release-panel,
  .release-drawer,
  .btn,
  .editor-pane,
  .tool-btn {
    transition: none !important;
  }
}
</style>
