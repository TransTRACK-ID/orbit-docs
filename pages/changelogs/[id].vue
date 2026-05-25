<script setup lang="ts">
import { nextTick } from "vue";
import { usePageStore } from "~/store/page";
import { renderMarkdown } from "~/composables/useMarkdown";

definePageMeta({
  auth: true,
});

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const changelogId = computed(() => route.params.id as string);

const {
  changelog,
  isLoading,
  isUpdating,
  fetchChangelog,
  updateChangelog,
} = useChangelogs();

const { apps, fetchApps } = useApps();
const { versions, fetchVersions } = useVersions();

// Editor state
const content = ref("");
const title = ref("");
const selectedAppId = ref("");
const selectedVersionId = ref("");
const status = ref<"draft" | "published">("draft");
const previewOnly = ref(false);
const hasChanges = ref(false);
const lastSavedAt = ref<Date | null>(null);

// Editor search
const editorSearch = ref("");

// History panel
const showHistoryPanel = ref(false);
const historySearch = ref("");
const historyFocusIndex = ref(0);
let lastFocusedElement: HTMLElement | null = null;

// Release panel
const showReleasePanel = ref(false);
const heroTitle = ref("");
const featureHeading = ref("");
const featureDesc = ref("");

onMounted(async () => {
  await fetchApps();
  if (changelogId.value) {
    await loadChangelog();
  }
});

async function loadChangelog() {
  try {
    const data = await fetchChangelog(changelogId.value);
    content.value = data.content || "";
    title.value = data.title;
    selectedAppId.value = data.appId;
    selectedVersionId.value = data.versionId || "";
    status.value = data.status;
    $page.setTitle(`Changelog: ${data.title}`);
    if (data.appId) {
      await fetchVersions(data.appId);
    }
    hasChanges.value = false;
    lastSavedAt.value = data.updatedAt ? new Date(data.updatedAt) : new Date();
  } catch {
    // Navigate back if changelog not found
    router.push("/changelogs");
  }
}

watch([content, title, selectedVersionId, status], () => {
  hasChanges.value = true;
}, { deep: true });

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

watch(selectedAppId, async (newAppId) => {
  if (newAppId) {
    await fetchVersions(newAppId);
    if (!versions.value.find(v => v.id === selectedVersionId.value)) {
      selectedVersionId.value = "";
    }
  }
});

// Markdown preview
const renderedPreview = computed(() => renderMarkdown(content.value));

// Toolbar helpers
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

// Save / Publish
async function saveDraft() {
  if (!changelogId.value) return;
  await updateChangelog(changelogId.value, {
    title: title.value,
    content: content.value,
    versionId: selectedVersionId.value || undefined,
    status: status.value,
  });
  hasChanges.value = false;
  lastSavedAt.value = new Date();
}

async function publishChangelog() {
  if (!changelogId.value) return;
  await updateChangelog(changelogId.value, {
    title: title.value,
    content: content.value,
    versionId: selectedVersionId.value || undefined,
    status: "published",
  });
  status.value = "published";
  hasChanges.value = false;
  lastSavedAt.value = new Date();
}

// History panel
function openHistory() {
  lastFocusedElement = document.activeElement as HTMLElement;
  showHistoryPanel.value = true;
  document.body.style.overflow = "hidden";
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

function selectHistoryItem(item: typeof historyItems.value[0]) {
  historyItems.value.forEach((h) => (h.active = false));
  item.active = true;
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
    if (activeItem) selectHistoryItem(activeItem);
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

// Release panel
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
  const checkedCats = releaseCategories.value.filter(c => c.checked);
  if (checkedCats.length > 0) {
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">${checkedCats.map(c => `<span class="pill ${c.colorClass}">${escapeHtml(c.label)}</span>`).join('')}</div>`;
  }
  return html;
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Keyboard shortcuts
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveDraft();
  }
  if (e.key === "Escape") {
    if (showHistoryPanel.value) closeHistory();
    if (showReleasePanel.value) closeReleasePanel();
  }
  // Delegate to panel focus traps when open
  if (showHistoryPanel.value) onHistoryPanelKeydown(e);
  if (showReleasePanel.value) onReleasePanelKeydown(e);
}

// Back navigation
function goBack() {
  router.push("/changelogs");
}

// Demo history data
const historyItems = ref([
  { time: "May 18, 2026 · 09:42 UTC", author: "Sarah Chen", action: "Current version", active: true },
  { time: "May 18, 2026 · 08:15 UTC", author: "Sarah Chen", action: "Added Security section", active: false },
  { time: "May 17, 2026 · 16:30 UTC", author: "Mike Ross", action: "Fixed webhook retry wording", active: false },
  { time: "May 17, 2026 · 14:00 UTC", author: "Sarah Chen", action: "Initial draft", active: false },
]);

const filteredHistory = computed(() => {
  const q = historySearch.value.toLowerCase().trim();
  if (!q) return historyItems.value;
  return historyItems.value.filter(
    h => h.author.toLowerCase().includes(q) || h.action.toLowerCase().includes(q)
  );
});
</script>

<template>
  <div class="changelog-editor-page" @keydown="onKeydown" tabindex="-1">
    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-title-group">
        <button class="btn btn-ghost" @click="goBack">
          <IconsChevronLeft size="16" />
        </button>
        <h1>{{ title || "Changelog Editor" }}</h1>
        <span class="pill" :class="status === 'published' ? 'pill-green' : 'pill-blue'">
          {{ status === 'published' ? 'Published' : 'Draft' }}
        </span>
      </div>
      <div class="topbar-actions">
        <select v-model="selectedAppId" class="select">
          <option v-for="app in apps" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>
        <select v-model="selectedVersionId" class="select">
          <option value="">No version</option>
          <option v-for="v in versions" :key="v.id" :value="v.id">
            {{ v.version }}
          </option>
        </select>
        <div class="btn-group">
          <button type="button" class="btn btn-ghost" :disabled="isUpdating" @click="saveDraft">
            {{ isUpdating ? "Saving…" : "Save" }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="isUpdating" @click="publishChangelog">
            {{ isUpdating ? "Publishing…" : "Publish" }}
          </button>
        </div>
        <button type="button" class="btn btn-primary" @click="openReleasePanel">
          Publish Release
        </button>
      </div>
    </header>

    <!-- Editor meta bar -->
    <div class="row-between" style="margin-bottom:16px;">
      <div class="flex-gap-md">
        <span class="text-muted-sm">Editing:</span>
        <input
          v-model="title"
          class="title-input"
          placeholder="Changelog title…"
        />
        <span v-if="saveStatusLabel" class="pill" :class="hasChanges ? 'pill-amber' : 'pill-green'">{{ saveStatusLabel }}</span>
      </div>
      <div class="flex-gap-sm">
        <input
          v-model="editorSearch"
          class="search search-changelog"
          placeholder="Search changelog…"
          aria-label="Search changelog content"
        />
        <button type="button" class="btn btn-ghost" @click="togglePreview">
          {{ previewOnly ? "Editor" : "Preview" }}
        </button>
        <button type="button" class="btn btn-ghost" @click="openHistory">
          History
        </button>
      </div>
    </div>

    <!-- Editor shell -->
    <div class="editor-shell" :class="{ 'preview-only': previewOnly }">
      <!-- Editor -->
      <div class="editor-pane">
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
            :key="index"
            class="history-item"
            :class="{ active: item.active }"
            role="listitem"
            tabindex="0"
            @click="selectHistoryItem(item); historyFocusIndex = index"
          >
            <div class="time">{{ item.time }}</div>
            <div class="author">{{ item.author }}</div>
            <div class="action">{{ item.action }}</div>
          </div>
          <div v-if="filteredHistory.length === 0" class="history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" aria-hidden="true"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            <p>No matching history</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Release Panel -->
    <div class="release-panel" :class="{ open: showReleasePanel }" role="dialog" aria-modal="true" aria-labelledby="releaseTitle" tabindex="-1" @click.self="closeReleasePanel">
      <div class="release-drawer">
        <div class="release-header">
          <h3 id="releaseTitle">Publish as Release Notes</h3>
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
          <button type="button" class="btn btn-primary" @click="closeReleasePanel">Publish Release</button>
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
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-group {
  display: flex;
  align-items: center;
}
.btn-group .btn {
  border-radius: 0;
  margin-left: -1px;
}
.btn-group .btn:first-child {
  border-radius: var(--radius) 0 0 var(--radius);
  margin-left: 0;
}
.btn-group .btn:last-child {
  border-radius: 0 var(--radius) var(--radius) 0;
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

.title-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  min-width: 240px;
}
.title-input:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
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
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  position: relative;
}
.history-item:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}
.history-item:hover {
  background: var(--fg-soft);
}
.history-item:active {
  background: color-mix(in oklch, var(--fg-soft) 70%, transparent);
  transform: scale(0.995);
}
.history-item.active {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 20%, transparent);
}
.history-item.active .author {
  color: var(--accent);
  font-weight: 500;
}
.history-item .time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.history-item .author {
  font-size: 13px;
  color: var(--fg);
  margin-top: 4px;
}
.history-item .action {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
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
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-red {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(50% 0.14 25);
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
