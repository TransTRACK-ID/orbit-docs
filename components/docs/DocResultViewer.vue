<script setup lang="ts">
import { marked } from "marked";
import type { DocGenerationVersion } from "~/composables/useDocGenerator";

interface Props {
  srs: string | null;
  fsd: string | null;
  sdd: string | null;
  appId?: string;
  jobId?: string;
  versions?: DocGenerationVersion[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "refresh"): void }>();

const activeTab = ref<"srs" | "fsd" | "sdd">("srs");
const editMode = ref(false);
const showHistory = ref(false);
const historySearch = ref("");

const tabs = [
  { key: "srs" as const, label: "SRS" },
  { key: "fsd" as const, label: "FSD" },
  { key: "sdd" as const, label: "SDD" },
];

// Editable copies of the content
const editedSrs = ref(props.srs || "");
const editedFsd = ref(props.fsd || "");
const editedSdd = ref(props.sdd || "");

// Watch prop changes to update local state
watch(() => props.srs, (v) => { if (!editMode.value) editedSrs.value = v || ""; });
watch(() => props.fsd, (v) => { if (!editMode.value) editedFsd.value = v || ""; });
watch(() => props.sdd, (v) => { if (!editMode.value) editedSdd.value = v || ""; });

const currentContent = computed(() => {
  if (activeTab.value === "srs") return editedSrs.value;
  if (activeTab.value === "fsd") return editedFsd.value;
  return editedSdd.value;
});

const renderedContent = computed(() => {
  const content = currentContent.value || "No content available";
  return marked.parse(content, { async: false });
});

const isCopied = ref(false);

async function copyContent() {
  try {
    await navigator.clipboard.writeText(currentContent.value);
    isCopied.value = true;
    setTimeout(() => (isCopied.value = false), 2000);
  } catch {
    // Fallback
  }
}

function downloadContent() {
  const blob = new Blob([currentContent.value], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activeTab.value.toUpperCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Save changes back to generation job ─────────────────────────
const { updateResult } = useDocGenerator();
const isSaving = ref(false);

async function saveChanges() {
  if (!props.appId || !props.jobId) return;
  isSaving.value = true;
  try {
    await updateResult(props.appId, props.jobId, {
      srs: editedSrs.value,
      fsd: editedFsd.value,
      sdd: editedSdd.value,
    });
    editMode.value = false;
    emit("refresh");
  } catch {
    // Error handled by composable
  } finally {
    isSaving.value = false;
  }
}

function toggleEditMode() {
  editMode.value = !editMode.value;
}

function onEditorChange(markdown: string) {
  if (activeTab.value === "srs") editedSrs.value = markdown;
  else if (activeTab.value === "fsd") editedFsd.value = markdown;
  else editedSdd.value = markdown;
}

// ── Version history (Changelog-style) ──────────────────────────
const filteredVersions = computed(() => {
  if (!props.versions) return [];
  let list = props.versions.filter((v) => v.docType === activeTab.value);
  const q = historySearch.value.toLowerCase().trim();
  if (q) {
    list = list.filter(
      (v) =>
        (v.actor || "").toLowerCase().includes(q) ||
        (v.content || "").toLowerCase().includes(q)
    );
  }
  return list;
});

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
  const groups: Record<string, typeof filteredVersions.value> = {};
  for (const item of filteredVersions.value) {
    const key = item.createdAt ? new Date(item.createdAt).toDateString() : "Unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).map(([dateKey, items]) => ({
    label: formatHistoryDate(items[0]?.createdAt ?? null),
    items,
  }));
});

function restoreVersion(version: DocGenerationVersion) {
  if (activeTab.value === "srs") editedSrs.value = version.content || "";
  else if (activeTab.value === "fsd") editedFsd.value = version.content || "";
  else editedSdd.value = version.content || "";
  editMode.value = true;
  showHistory.value = false;
}

function closeHistory() {
  showHistory.value = false;
  historySearch.value = "";
}
</script>

<template>
  <div class="result-viewer">
    <div class="result-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>

      <div class="tab-actions">
        <button
          v-if="!editMode && filteredVersions.length > 0"
          class="btn btn-ghost btn-sm"
          :class="{ active: showHistory }"
          @click="showHistory = !showHistory"
        >
          History ({{ filteredVersions.length }})
        </button>
        <button class="btn btn-ghost btn-sm" @click="toggleEditMode">
          {{ editMode ? "View" : "Edit" }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="copyContent">
          <span v-if="isCopied">Copied!</span>
          <span v-else>Copy</span>
        </button>
        <button class="btn btn-ghost btn-sm" @click="downloadContent">
          Download
        </button>
      </div>
    </div>

    <div class="result-body">
      <div class="result-content">
        <div v-if="editMode" class="editor-pane">
          <ClientOnly>
            <EditorJs
              v-model="currentContent"
              placeholder="Edit your generated documentation..."
              style="height: 100%;"
              @change="(_, markdown) => onEditorChange(markdown)"
            />
          </ClientOnly>
        </div>
        <div v-else class="markdown-body" v-html="renderedContent" />
      </div>
    </div>

    <div v-if="editMode" class="editor-footer">
      <button
        class="btn btn-primary btn-sm"
        :disabled="isSaving"
        @click="saveChanges"
      >
        <span v-if="isSaving">Saving…</span>
        <span v-else>Save Changes</span>
      </button>
      <button class="btn btn-ghost btn-sm" @click="toggleEditMode">
        Cancel
      </button>
    </div>

    <!-- History Panel (Changelog-style slide-out drawer) -->
    <div class="history-panel" :class="{ open: showHistory }" role="dialog" aria-modal="true" aria-labelledby="historyTitle" tabindex="-1" @click.self="closeHistory">
      <div class="history-drawer">
        <div class="history-header">
          <h3 id="historyTitle">Version History — {{ tabs.find(t => t.key === activeTab)?.label }}</h3>
          <button type="button" class="btn btn-ghost history-close" aria-label="Close version history" @click="closeHistory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="history-search-wrap">
          <input v-model="historySearch" type="search" class="history-search" placeholder="Filter by author or content…" aria-label="Filter version history" />
        </div>
        <div class="history-list" role="list">
          <template v-if="filteredVersions.length > 0">
            <div v-for="group in groupedHistory" :key="group.label" class="history-group">
              <div class="history-date-sep" aria-hidden="true">
                <span class="history-date-label">{{ group.label }}</span>
                <span class="history-date-line"></span>
              </div>
              <div
                v-for="(item, index) in group.items"
                :key="item.id"
                class="history-item"
                role="listitem"
                tabindex="0"
                @keydown.enter.prevent="restoreVersion(item)"
                @keydown.space.prevent="restoreVersion(item)"
              >
                <div class="history-timeline" aria-hidden="true">
                  <span class="history-dot" :class="index === 0 ? 'history-dot-latest' : ''"></span>
                  <span class="history-line"></span>
                </div>
                <div class="history-item-main">
                  <p class="history-preview">{{ previewContent(item.content) }}</p>
                  <div class="history-meta-row">
                    <span class="history-time">{{ formatHistoryTime(item.createdAt) }}</span>
                    <span class="history-actor">{{ item.actor || "Unknown" }}</span>
                    <span class="pill" :class="index === 0 ? 'pill-accent' : 'pill-muted'">{{ index === 0 ? 'Latest' : 'Edit' }}</span>
                  </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm history-restore" @click.stop="restoreVersion(item)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Restore
                </button>
              </div>
            </div>
          </template>
          <div v-else class="history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" aria-hidden="true"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            <p>No history yet</p>
            <span class="text-muted-sm">Save changes to create history entries</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-viewer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.result-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.tab-btn {
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.tab-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-soft);
}

.tab-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.result-body {
  display: flex;
  gap: 0;
  min-height: 400px;
}

.result-content {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
  flex: 1;
}

/* History panel (Changelog-style slide-out drawer) */
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
  font-weight: 600;
  color: var(--fg);
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
  background: var(--muted);
}

.history-dot-latest {
  background: var(--accent);
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

.text-muted-sm {
  font-size: 13px;
  color: var(--muted);
}

/* Pills */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}

.pill-muted {
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  color: var(--muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.editor-pane {
  min-height: 400px;
  height: 60vh;
}

.editor-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

/* Markdown styling */
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
}

:deep(.markdown-body h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

:deep(.markdown-body h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px;
}

:deep(.markdown-body h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 20px 0 10px;
}

:deep(.markdown-body p) {
  margin: 0 0 12px;
}

:deep(.markdown-body ul, .markdown-body ol) {
  margin: 0 0 12px;
  padding-left: 24px;
}

:deep(.markdown-body li) {
  margin-bottom: 4px;
}

:deep(.markdown-body code) {
  background: var(--fg-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

:deep(.markdown-body pre) {
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 12px 0;
  border: 1px solid var(--border);
}

:deep(.markdown-body pre code) {
  background: none;
  padding: 0;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

:deep(.markdown-body th, .markdown-body td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--border);
}

:deep(.markdown-body th) {
  background: var(--bg);
  font-weight: 600;
}

:deep(.markdown-body blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 3px solid var(--accent);
  background: var(--fg-soft);
  color: var(--muted);
}

:deep(.markdown-body hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 20px 0;
}

:deep(.markdown-body a) {
  color: var(--accent);
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}
</style>
