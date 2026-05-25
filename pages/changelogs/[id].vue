<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ChangelogHistoryEntry } from "~/composables/useChangelogs";

definePageMeta({
  auth: { required: true },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Changelog Editor");
});

const route = useRoute();
const router = useRouter();
const changelogId = computed(() => route.params.id as string);

const { apps, fetchApps } = useApps();
const { changelog, history, isLoading, isSaving, isUpdating, fetchChangelog, fetchHistory, saveDraft, publishChangelog, updateChangelog } = useChangelogs();

// Editor state
const content = ref("");
const previewOnly = ref(false);
const autoSaveStatus = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// History panel
const showHistory = ref(false);
const historySearch = ref("");
const historyFocusIndex = ref(0);
const lastFocusedElement = ref<HTMLElement | null>(null);

// Release panel
const showReleasePanel = ref(false);
const releaseLastFocused = ref<HTMLElement | null>(null);
const heroTitle = ref("");
const featureHeading = ref("");
const featureDesc = ref("");
const releaseCategories = ref<string[]>([]);

onMounted(async () => {
  await fetchApps();
  if (changelogId.value) {
    await fetchChangelog(changelogId.value);
    await fetchHistory(changelogId.value);
  }
});

watch(() => changelog.value, (c) => {
  if (c && content.value === "") {
    content.value = c.content || "";
  }
}, { immediate: true });

const previewHtml = computed(() => renderMarkdown(content.value));

// Auto-save debounce
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
watch(content, () => {
  autoSaveStatus.value = "Saving…";
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (changelogId.value && content.value !== (changelog.value?.content || "")) {
      try {
        await updateChangelog(changelogId.value, { content: content.value });
        autoSaveStatus.value = "Auto-saved just now";
      } catch {
        autoSaveStatus.value = "Save failed";
      }
    } else {
      autoSaveStatus.value = "Auto-saved just now";
    }
  }, 2000);
});

// Toolbar actions
function wrapText(before: string, after?: string) {
  const ta = textareaRef.value;
  if (!ta) return;
  after = after || before;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  const selected = text.slice(start, end);
  const replacement = before + selected + after;
  ta.setRangeText(replacement, start, end, "end");
  ta.focus();
  ta.setSelectionRange(start + before.length, start + before.length + selected.length);
  content.value = ta.value;
}

function insertLine(prefix: string) {
  const ta = textareaRef.value;
  if (!ta) return;
  const start = ta.selectionStart;
  const text = ta.value;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  ta.setRangeText(prefix, lineStart, lineStart, "end");
  ta.focus();
  ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
  content.value = ta.value;
}

function togglePreview() {
  previewOnly.value = !previewOnly.value;
}

// History panel
function openHistory() {
  lastFocusedElement.value = document.activeElement as HTMLElement;
  showHistory.value = true;
  document.body.style.overflow = "hidden";
  nextTick(() => {
    const searchInput = document.getElementById("historySearch") as HTMLInputElement;
    if (searchInput) searchInput.focus();
  });
}

function closeHistory() {
  showHistory.value = false;
  document.body.style.overflow = "";
  if (lastFocusedElement.value) {
    setTimeout(() => lastFocusedElement.value?.focus(), 50);
  }
}

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase();
  if (!q) return history.value;
  return history.value.filter((h) =>
    (h.actor && h.actor.toLowerCase().includes(q)) ||
    (h.action && h.action.toLowerCase().includes(q))
  );
});

function selectHistoryItem(item: ChangelogHistoryEntry, index: number) {
  historyFocusIndex.value = index;
  if (item.content !== null) {
    content.value = item.content;
  }
  showToast(`Restored version by ${item.actor}`);
}

function focusHistoryItem(index: number) {
  const items = document.querySelectorAll(".history-item");
  if (items.length === 0) return;
  const i = Math.max(0, Math.min(index, items.length - 1));
  (items[i] as HTMLElement).focus();
}

// Release panel
function openReleasePanel() {
  releaseLastFocused.value = document.activeElement as HTMLElement;
  showReleasePanel.value = true;
  document.body.style.overflow = "hidden";
  parseChangelogCategories();
  nextTick(() => {
    const input = document.getElementById("heroTitle") as HTMLInputElement;
    if (input) input.focus();
  });
}

function closeReleasePanel() {
  showReleasePanel.value = false;
  document.body.style.overflow = "";
  if (releaseLastFocused.value) {
    setTimeout(() => releaseLastFocused.value?.focus(), 50);
  }
}

function parseChangelogCategories() {
  const text = content.value;
  const cats: string[] = [];
  const seen = new Set<string>();
  const regex = /^###\s+(Added|Fixed|Changed|Deprecated|Security)/gim;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const label = match[1];
    if (!seen.has(label)) {
      seen.add(label);
      cats.push(label);
    }
  }
  releaseCategories.value = cats;

  // Auto-suggest hero title from first h2
  const h2Match = text.match(/^##\s+\[?([^\n\]]+)/m);
  if (h2Match && !heroTitle.value) {
    heroTitle.value = h2Match[1].trim();
  }
}

function getPillClass(c: string) {
  if (c === "Added") return "pill-green";
  if (c === "Fixed") return "pill-blue";
  if (c === "Changed") return "pill-amber";
  if (c === "Deprecated") return "pill-purple";
  return "pill-red";
}

const releasePreviewHtml = computed(() => {
  const title = heroTitle.value.trim();
  const heading = featureHeading.value.trim();
  const desc = featureDesc.value.trim();
  if (!title) return '<p style="color:var(--muted);">Enter a headline to see preview</p>';
  let html = `<h4>Release Preview</h4><p style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(title)}</p>`;
  if (heading) {
    html += `<p style="font-weight:600;margin:16px 0 4px;">${escapeHtml(heading)}</p>`;
    if (desc) html += `<p style="color:var(--muted);margin:0 0 12px;">${escapeHtml(desc)}</p>`;
  }
  const checkedCats = releaseCategories.value;
  if (checkedCats.length > 0) {
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">${checkedCats.map((c) => `<span class="pill pill-muted">${escapeHtml(c)}</span>`).join("")}</div>`;
  }
  return html;
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Toast
const toastMsg = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  toastMsg.value = msg;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}

// Save / Publish
async function handleSaveDraft() {
  if (!changelogId.value) return;
  await saveDraft(changelogId.value, content.value);
  autoSaveStatus.value = "";
}

async function handlePublishChangelog() {
  if (!changelogId.value) return;
  await publishChangelog(changelogId.value);
}

async function handlePublishRelease() {
  if (!changelogId.value || !changelog.value) return;
  // Create a release from this changelog
  const { createRelease } = useReleases();
  try {
    await createRelease({
      appId: changelog.value.appId,
      versionId: changelog.value.versionId || "",
      heroTitle: heroTitle.value || null,
      summary: featureDesc.value || null,
      published: true,
    });
    closeReleasePanel();
    showToast("Release published");
    await navigateTo("/releases");
  } catch (e: any) {
    showToast(e?.data?.message || "Failed to publish release");
  }
}

// Keyboard handlers
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeHistory();
    closeReleasePanel();
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));

// Formatters
function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

const statusClass: Record<string, string> = {
  published: "pill-green",
  draft: "pill-blue",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};
</script>

<template>
  <div class="changelog-editor">
    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-title-group">
        <h1>Changelog Editor</h1>
        <span v-if="changelog" class="pill" :class="statusClass[changelog.status]">
          {{ changelog.appName }} {{ changelog.version ? `v${changelog.version}` : "" }}
        </span>
      </div>
      <div class="topbar-actions">
        <button type="button" class="btn btn-ghost" :disabled="isSaving" @click="handleSaveDraft">
          <span v-if="isSaving">Saving…</span>
          <span v-else>Save</span>
        </button>
        <button type="button" class="btn btn-secondary" :disabled="isUpdating" @click="handlePublishChangelog">
          Publish
        </button>
        <button type="button" class="btn btn-primary" @click="openReleasePanel">
          Publish Release
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="content">
      <div class="row-between" style="margin-bottom: 16px;">
        <div class="flex-gap-md">
          <span class="text-muted-sm">Editing:</span>
          <strong>CHANGELOG.md</strong>
          <span v-if="autoSaveStatus" class="pill pill-green">{{ autoSaveStatus }}</span>
        </div>
        <div class="flex-gap-sm">
          <button type="button" class="btn btn-ghost" :class="{ active: previewOnly }" @click="togglePreview">
            {{ previewOnly ? "Editor" : "Preview" }}
          </button>
          <button type="button" class="btn btn-ghost" @click="openHistory">
            History
          </button>
        </div>
      </div>

      <!-- Editor shell -->
      <div class="editor-shell" :class="{ 'preview-only': previewOnly }">
        <!-- Editor pane -->
        <div class="editor-pane">
          <div class="toolbar">
            <button type="button" class="tool-btn" @click="wrapText('## ')">H2</button>
            <button type="button" class="tool-btn" @click="wrapText('### ')">H3</button>
            <button type="button" class="tool-btn" @click="wrapText('**','**')">B</button>
            <button type="button" class="tool-btn" @click="wrapText('*','*')">I</button>
            <button type="button" class="tool-btn" @click="wrapText('\`','\`')">`code`</button>
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
              aria-label="Changelog markdown editor"
            />
          </div>
        </div>

        <!-- Preview pane -->
        <div class="editor-pane">
          <div class="pane-header">
            <span>Preview</span>
            <span class="meta-label">Rendered from markdown</span>
          </div>
          <div class="pane-body preview-body" v-html="previewHtml" />
        </div>
      </div>
    </main>

    <!-- History Panel -->
    <div
      class="history-panel"
      :class="{ open: showHistory }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historyTitle"
      tabindex="-1"
      @click.self="closeHistory"
    >
      <div class="history-drawer">
        <div class="history-header">
          <h3 id="historyTitle">Version history</h3>
          <button type="button" class="btn btn-ghost history-close" aria-label="Close version history" @click="closeHistory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="history-search-wrap">
          <input
            id="historySearch"
            v-model="historySearch"
            type="search"
            class="history-search"
            placeholder="Filter by author or action…"
            aria-label="Filter version history"
          />
        </div>
        <div class="history-list" role="list">
          <div
            v-for="(item, index) in filteredHistory"
            :key="item.id"
            class="history-item"
            :class="{ active: index === 0 }"
            role="listitem"
            tabindex="0"
            @click="selectHistoryItem(item, index)"
            @keydown.enter="selectHistoryItem(item, index)"
            @keydown.space.prevent="selectHistoryItem(item, index)"
          >
            <div class="time">{{ formatDate(item.createdAt) }} · {{ formatTime(item.createdAt) }}</div>
            <div class="author">{{ item.actor }}</div>
            <div class="action">{{ item.action }}</div>
          </div>
          <div v-if="filteredHistory.length === 0" class="history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" aria-hidden="true">
              <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <p>No history entries</p>
            <span class="meta-label">Changes will appear here once you start editing</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Release Panel -->
    <div
      class="release-panel"
      :class="{ open: showReleasePanel }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="releaseTitle"
      tabindex="-1"
      @click.self="closeReleasePanel"
    >
      <div class="release-drawer">
        <div class="release-header">
          <h3 id="releaseTitle">Publish as Release Notes</h3>
          <button type="button" class="btn btn-ghost release-close" aria-label="Close release panel" @click="closeReleasePanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
              <span v-if="releaseCategories.length === 0" class="meta-label">No categories detected</span>
              <label v-for="cat in releaseCategories" :key="cat" class="release-cat-tag">
                <input type="checkbox" checked />
                <span class="pill" :class="getPillClass(cat)">{{ cat }}</span>
              </label>
            </div>
          </div>
          <div class="release-section">
            <div class="release-section-title">Preview</div>
            <div class="release-preview-box" v-html="releasePreviewHtml" />
          </div>
        </div>
        <div class="release-footer">
          <button type="button" class="btn btn-secondary" @click="closeReleasePanel">Cancel</button>
          <button type="button" class="btn btn-primary" @click="handlePublishRelease">
            Publish Release
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">
      {{ toastMsg }}
    </div>
  </div>
</template>

<style scoped>
.changelog-editor {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
}
.topbar h1 {
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
  margin: 0;
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

.content {
  padding: 32px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
.meta-label {
  font-size: 12px;
  color: var(--muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
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
.btn-ghost.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.16 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.pill-red {
  background: color-mix(in oklch, oklch(60% 0.18 25) 12%, transparent);
  color: oklch(55% 0.14 25);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
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
}
.preview-body :deep(pre code) {
  background: none;
  padding: 0;
}
.preview-body :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  margin: 12px 0;
  color: var(--muted);
}
.preview-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}
.preview-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}
.preview-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 12px 0;
}
.preview-body :deep(th),
.preview-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}
.preview-body :deep(th) {
  background: var(--bg);
  font-weight: 600;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  right: 32px;
  z-index: 200;
  background: var(--fg);
  color: var(--surface);
  padding: 12px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 20%, transparent);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.toast.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
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
.release-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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

@media (prefers-reduced-motion: reduce) {
  .history-panel,
  .history-drawer,
  .release-panel,
  .release-drawer,
  .toast,
  .btn,
  .tool-btn,
  .history-item {
    transition: none !important;
  }
}

@media (max-width: 768px) {
  .topbar {
    flex-wrap: wrap;
    height: auto;
    padding: 12px 16px;
  }
  .content {
    padding: 16px;
  }
}
</style>
