<script setup lang="ts">
import { nextTick, ref } from "vue";
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
const { versions, fetchVersions, fetchVersionById, updateVersion } = useVersions();
const { createRelease } = useReleases();
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
const isInitializing = ref(true);

// ── Category hint ────────────────────────────────────────────────
const showCategoryHint = ref(true);

function insertCategoryHeader(category: string) {
  const insertion = `## ${category}\n- `;
  content.value = content.value + (content.value ? "\n\n" : "") + insertion;
}

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

  let queryVersionId = route.query.versionId as string | undefined;
  let queryAppId = route.query.app as string | undefined;
  const persistedAppId = $page.selectedAppId;

  // If versionId is provided without app, look up the version to find its app
  if (queryVersionId && !queryAppId) {
    try {
      const versionData = await fetchVersionById(queryVersionId);
      if (versionData?.appId && apps.value.find((a) => a.id === versionData.appId)) {
        queryAppId = versionData.appId;
      }
    } catch {
      // Version not found or error, fall through to normal selection
    }
  }

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

    // Priority: URL param > latest version (first in desc order) > persisted
    if (queryVersionId && versions.value.find((v) => v.id === queryVersionId)) {
      selectedVersionId.value = queryVersionId;
    } else if (versions.value.length > 0) {
      selectedVersionId.value = versions.value[0].id;
    }
  }

  if (selectedVersionId.value) {
    await loadVersion(selectedVersionId.value);
    await checkExistingRelease(selectedVersionId.value);
  }

  syncUrlQuery();
  isInitializing.value = false;
});

async function loadVersion(versionId: string) {
  const version = versions.value.find((v) => v.id === versionId);
  if (!version) return;

  currentVersion.value = version;
  let releaseNotes = version.releaseNotes || "";

  // If releaseNotes is empty, try to reconstruct from the release's categories
  if (!releaseNotes.trim()) {
    try {
      const data = await $fetch<{ data: Array<{ id: string; categories: Record<string, string[]> }> }>("/api/releases", {
        query: { version: versionId, limit: "10" },
      });
      const release = data.data[0];
      if (release?.categories) {
        releaseNotes = categoriesToMarkdown(release.categories);
      }
    } catch {
      // Silently fail if release categories can't be fetched
    }
  }

  content.value = releaseNotes;
  status.value = version.status === "published" ? "published" : "draft";
  hasChanges.value = false;
  lastSavedAt.value = version.updatedAt ? new Date(version.updatedAt) : new Date();
}

function categoriesToMarkdown(categories: Record<string, string[]>): string {
  const lines: string[] = [];
  const categoryOrder = ["Added", "Fixed", "Changed", "Deprecated", "Security"];

  for (const category of categoryOrder) {
    const items = categories[category.toLowerCase()];
    if (items && items.length > 0) {
      lines.push(`## ${category}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
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
  if (!newAppId || newAppId === oldAppId) return;
  await fetchVersions(newAppId);
  if (versions.value.length > 0) {
    // Respect URL query parameter if the version belongs to this app
    const queryVersionId = route.query.versionId as string | undefined;
    if (queryVersionId && versions.value.find((v) => v.id === queryVersionId)) {
      selectedVersionId.value = queryVersionId;
    } else {
      // Default to the latest version (first in desc order) when app changes
      selectedVersionId.value = versions.value[0].id;
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
    // Sync the NORMAL release (source of truth) from markdown changelog edits.
    if (releases.normal?.id) {
      await $fetch(`/api/releases/${releases.normal.id}`, {
        method: "PUT",
        body: { categories, summary },
      });
    }
    // Also sync categories to the ARTICLE release so its badge counts
    // reflect the latest changelog data (hero/summary/features stay untouched).
    if (releases.article?.id) {
      await $fetch(`/api/releases/${releases.article.id}`, {
        method: "PUT",
        body: { categories },
      });
    }
  } catch (err) {
    // Log sync failures for debugging; the version save is the primary action
    console.error("Failed to sync release from changelog:", err);
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("History snapshot failed:", err);
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
    if (activeItem && isRestorableAction(activeItem.action)) restoreHistoryItem(activeItem);
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
    const headerMatch = line.match(/^##\s+(Added|Fixed|Changed|Deprecated|Security)/i);
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
      await createHistorySnapshot(currentVersion.value.id, content.value, "quick_release");
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
      await createHistorySnapshot(currentVersion.value.id, content.value, "article_release");
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Fetch history failed:", err);
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
      (h.action || "").toLowerCase().includes(q) ||
      (h.content || "").toLowerCase().includes(q)
  );
});

function historyActionClass(action: string): string {
  switch (action) {
    case "publish": return "pill-green";
    case "quick_release": return "pill-amber";
    case "article_release": return "pill-purple";
    default: return "pill-muted";
  }
}

function historyActionLabel(action: string): string {
  switch (action) {
    case "quick_release": return "quick release";
    case "article_release": return "article release";
    default: return action;
  }
}

function isRestorableAction(action: string): boolean {
  return action === "save" || action === "publish";
}

function historyDotClass(action: string): string {
  switch (action) {
    case "publish": return "history-dot-publish";
    case "quick_release": return "history-dot-amber";
    case "article_release": return "history-dot-purple";
    default: return "history-dot-save";
  }
}

function previewContent(text: string, maxLen = 140): string {
  if (!text) return "No content";
  const cleaned = text.replace(/^\s*[#\-*\d.\[\]>\s]+/gm, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).replace(/\s+[^\s]*$/, "") + "…";
}

function formatHistoryDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatHistoryTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const groupedHistory = computed(() => {
  const groups: Record<string, typeof historyItems.value> = {};
  for (const item of filteredHistory.value) {
    const key = item.createdAt ? new Date(item.createdAt).toDateString() : "Unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).map(([dateKey, items]) => ({
    label: formatHistoryDate(items[0]?.createdAt ?? null),
    items,
  }));
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
            type="button"
            class="btn btn-sm btn-secondary"
            :disabled="isUpdating || !currentVersion"
            @click="saveDraft"
          >
            {{ isUpdating ? "Saving…" : "Save" }}
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
        <button
          v-if="releasesForVersion.normal"
          type="button"
          class="btn btn-ghost btn-sm btn-icon"
          @click="navigateTo(`/releases/${releasesForVersion.normal.id}`)"
          title="View Normal"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
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

    <!-- Loading state while initializing -->
    <div v-if="isInitializing" class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon" style="opacity: 0.5;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="10">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <p class="empty-state-desc">Loading changelog editor…</p>
      </div>
    </div>

    <!-- Empty state: onboarding for new users -->
    <div v-else-if="!currentVersion" class="empty-state">
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
        <div class="format-hint" v-if="showCategoryHint">
          <div class="format-hint-main">
            <span class="format-hint-label">Use category headers to create colored badges on public release pages.</span>
            <button type="button" class="format-hint-close" @click="showCategoryHint = false" aria-label="Dismiss category hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="format-hint-tags">
            <button type="button" class="format-hint-tag tag-added" @click="insertCategoryHeader('Added')">## Added</button>
            <button type="button" class="format-hint-tag tag-fixed" @click="insertCategoryHeader('Fixed')">## Fixed</button>
            <button type="button" class="format-hint-tag tag-changed" @click="insertCategoryHeader('Changed')">## Changed</button>
            <button type="button" class="format-hint-tag tag-deprecated" @click="insertCategoryHeader('Deprecated')">## Deprecated</button>
            <button type="button" class="format-hint-tag tag-security" @click="insertCategoryHeader('Security')">## Security</button>
          </div>
        </div>
        <div class="pane-body" style="padding:0;overflow:visible;">
          <ClientOnly>
            <EditorJs
              v-model="content"
              placeholder="Enter changelog markdown…"
              style="height:100%;"
            />
          </ClientOnly>
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
          <template v-if="!isHistoryLoading && filteredHistory.length > 0">
            <div v-for="group in groupedHistory" :key="group.label" class="history-group">
              <div class="history-date-sep" aria-hidden="true">
                <span class="history-date-label">{{ group.label }}</span>
                <span class="history-date-line"></span>
              </div>
              <div
                v-for="(item, index) in group.items"
                :key="item.id"
                class="history-item"
                :class="{ 'history-item-restorable': isRestorableAction(item.action) }"
                role="listitem"
                tabindex="0"
                @click="historyFocusIndex = index"
                @keydown.enter.prevent="isRestorableAction(item.action) && restoreHistoryItem(item)"
                @keydown.space.prevent="isRestorableAction(item.action) && restoreHistoryItem(item)"
              >
                <div class="history-timeline" aria-hidden="true">
                  <span class="history-dot" :class="historyDotClass(item.action)"></span>
                  <span class="history-line"></span>
                </div>
                <div class="history-item-main">
                  <p class="history-preview">{{ previewContent(item.content) }}</p>
                  <div class="history-meta-row">
                    <span class="history-time">{{ formatHistoryTime(item.createdAt) }}</span>
                    <span class="history-actor">{{ item.actor || "Unknown" }}</span>
                    <span class="pill" :class="historyActionClass(item.action)">{{ historyActionLabel(item.action) }}</span>
                  </div>
                </div>
                <button v-if="isRestorableAction(item.action)" type="button" class="btn btn-ghost btn-sm history-restore" @click.stop="restoreHistoryItem(item)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Restore
                </button>
              </div>
            </div>
          </template>
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

.editor-pane:has(.editor-js-wrapper) {
  overflow: visible;
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
  list-style-type: disc;
}
.preview-body :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
  list-style-type: decimal;
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
.btn-icon {
  padding: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  width: 480px;
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
  padding: 0;
}
.history-group {
  position: relative;
  padding: 0 20px;
}
.history-group::before {
  content: "";
  position: absolute;
  left: 29px;
  top: 44px;
  bottom: 16px;
  width: 1.5px;
  background: var(--border);
  z-index: 0;
}
.history-date-sep {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 8px;
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 2;
}
.history-date-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  flex-shrink: 0;
}
.history-date-line {
  flex: 1;
  height: 1px;
  background: var(--border);
  min-width: 0;
}
.history-item {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 12px 0 16px;
  cursor: pointer;
  outline: none;
  position: relative;
}
.history-item:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
  border-radius: var(--radius);
}
.history-item:hover {
  background: var(--fg-soft);
  border-radius: var(--radius);
}
.history-item:hover .history-restore {
  color: var(--accent);
}
.history-timeline {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  margin-right: 12px;
  padding-top: 6px;
}
.history-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.history-dot-save {
  background: var(--muted);
}
.history-dot-publish {
  background: oklch(65% 0.18 145);
}
.history-dot-amber {
  background: oklch(65% 0.15 75);
}
.history-dot-purple {
  background: oklch(55% 0.2 295);
}
.history-line {
  display: none;
}
.history-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.history-preview {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--fg);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.history-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.history-time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}
.history-actor {
  font-size: 12px;
  color: var(--muted);
}
.history-restore {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  margin-left: 8px;
  color: var(--muted);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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
  padding: 10px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.format-hint-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.format-hint-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
  line-height: 1.4;
}
.format-hint-close {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.format-hint-close:hover {
  color: var(--fg);
  background: var(--fg-soft);
}
.format-hint-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.format-hint-tag {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--font-mono);
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.format-hint-tag:hover {
  background: var(--fg-soft);
  color: var(--fg);
  border-color: var(--fg);
}
.format-hint-tag.tag-added {
  background: color-mix(in oklch, oklch(65% 0.14 145) 8%, transparent);
  border-color: color-mix(in oklch, oklch(65% 0.14 145) 20%, var(--border));
  color: oklch(50% 0.12 145);
}
.format-hint-tag.tag-added:hover {
  background: color-mix(in oklch, oklch(65% 0.14 145) 15%, transparent);
  border-color: color-mix(in oklch, oklch(65% 0.14 145) 35%, var(--border));
}
.format-hint-tag.tag-fixed {
  background: color-mix(in oklch, oklch(55% 0.14 255) 8%, transparent);
  border-color: color-mix(in oklch, oklch(55% 0.14 255) 20%, var(--border));
  color: oklch(45% 0.12 255);
}
.format-hint-tag.tag-fixed:hover {
  background: color-mix(in oklch, oklch(55% 0.14 255) 15%, transparent);
  border-color: color-mix(in oklch, oklch(55% 0.14 255) 35%, var(--border));
}
.format-hint-tag.tag-changed {
  background: color-mix(in oklch, oklch(70% 0.12 85) 8%, transparent);
  border-color: color-mix(in oklch, oklch(70% 0.12 85) 20%, var(--border));
  color: oklch(55% 0.10 85);
}
.format-hint-tag.tag-changed:hover {
  background: color-mix(in oklch, oklch(70% 0.12 85) 15%, transparent);
  border-color: color-mix(in oklch, oklch(70% 0.12 85) 35%, var(--border));
}
.format-hint-tag.tag-deprecated {
  background: color-mix(in oklch, oklch(60% 0.14 300) 8%, transparent);
  border-color: color-mix(in oklch, oklch(60% 0.14 300) 20%, var(--border));
  color: oklch(50% 0.12 300);
}
.format-hint-tag.tag-deprecated:hover {
  background: color-mix(in oklch, oklch(60% 0.14 300) 15%, transparent);
  border-color: color-mix(in oklch, oklch(60% 0.14 300) 35%, var(--border));
}
.format-hint-tag.tag-security {
  background: color-mix(in oklch, oklch(60% 0.14 25) 8%, transparent);
  border-color: color-mix(in oklch, oklch(60% 0.14 25) 20%, var(--border));
  color: oklch(50% 0.12 25);
}
.format-hint-tag.tag-security:hover {
  background: color-mix(in oklch, oklch(60% 0.14 25) 15%, transparent);
  border-color: color-mix(in oklch, oklch(60% 0.14 25) 35%, var(--border));
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
