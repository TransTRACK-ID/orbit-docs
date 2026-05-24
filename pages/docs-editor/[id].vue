<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const docId = computed(() => route.params.id as string);

const {
  currentDoc,
  isLoading,
  isSaving,
  fetchDoc,
  updateDoc,
  publishDoc,
} = useDocs();

const editorContent = ref("");
const editorTitle = ref("");
const editorStatus = ref("draft");
const editorVersionId = ref<string | null>(null);
const editorTags = ref<string[]>([]);
const tagInputVisible = ref(false);
const tagInputValue = ref("");
const previewOnly = ref(false);
const toastMsg = ref("");
const toastVisible = ref(false);
const shortcutsVisible = ref(false);
const activeHeading = ref("");
const docLoading = ref(false);
const docNotFound = ref(false);

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  toastMsg.value = msg;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}

function togglePreview() {
  previewOnly.value = !previewOnly.value;
  showToast(previewOnly.value ? "Preview mode" : "Split view");
}

async function saveDraft() {
  if (!docId.value) return;
  await updateDoc(docId.value, {
    title: editorTitle.value,
    content: editorContent.value,
    status: editorStatus.value,
    versionId: editorVersionId.value ?? null,
    tags: editorTags.value,
  });
}

async function doPublish() {
  if (!docId.value) return;
  await saveDraft();
  await publishDoc(docId.value);
  editorStatus.value = "published";
}

function generatePDF() {
  showToast("Generating PDF…");
  setTimeout(() => showToast("PDF ready for download"), 1500);
}

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const previewRef = ref<HTMLDivElement | null>(null);

function wrapText(before: string, after?: string) {
  after = after || before;
  const ta = textareaRef.value;
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  const selected = text.slice(start, end);
  const replacement = before + selected + after;
  ta.setRangeText(replacement, start, end, "end");
  ta.focus();
  ta.setSelectionRange(
    start + before.length,
    start + before.length + selected.length
  );
  editorContent.value = ta.value;
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
  editorContent.value = ta.value;
}

function insertTable() {
  const ta = textareaRef.value;
  if (!ta) return;
  const table = "\n| Column | Column |\n|--------|--------|\n| Cell   | Cell   |\n";
  const start = ta.selectionStart;
  ta.setRangeText(table, start, start, "end");
  ta.focus();
  editorContent.value = ta.value;
}

function removeTag(index: number) {
  editorTags.value.splice(index, 1);
}

function startAddTag() {
  tagInputVisible.value = true;
  nextTick(() => {
    const input = document.getElementById("tagInputField") as HTMLInputElement;
    if (input) input.focus();
  });
}

function finishAddTag() {
  const val = tagInputValue.value.trim();
  if (val && !editorTags.value.includes(val)) {
    editorTags.value.push(val);
  }
  tagInputValue.value = "";
  tagInputVisible.value = false;
}

function onTagKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    finishAddTag();
  }
  if (e.key === "Escape") {
    tagInputValue.value = "";
    tagInputVisible.value = false;
  }
}

const headings = computed(() => extractHeadings(editorContent.value));
const renderedHtml = computed(() => renderMarkdown(editorContent.value));

function scrollToHeading(text: string) {
  activeHeading.value = text;
  // Try to find the heading line in the textarea and move cursor there
  const ta = textareaRef.value;
  if (ta) {
    const lines = ta.value.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match && match[2].trim() === text) {
        let pos = 0;
        for (let j = 0; j < i; j++) pos += lines[j].length + 1;
        ta.focus();
        ta.setSelectionRange(pos, pos);
        // Scroll the line into view roughly
        const lineHeight = 22; // approximate
        ta.scrollTop = Math.max(0, i * lineHeight - ta.clientHeight / 2);
        break;
      }
    }
  }
  showToast("Jumped to: " + text);
}

function toggleShortcuts() {
  shortcutsVisible.value = !shortcutsVisible.value;
  if (shortcutsVisible.value) {
    setTimeout(() => {
      shortcutsVisible.value = false;
    }, 5000);
  }
}

function onKeydown(e: KeyboardEvent) {
  // Ctrl+S / Cmd+S — Save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveDraft();
  }
  // Ctrl+P / Cmd+P — Preview toggle
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    togglePreview();
  }
  // Ctrl+? / Cmd+? — Shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    e.preventDefault();
    toggleShortcuts();
  }
}

function onTagRemoveKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.target as HTMLElement).classList.contains("tag-remove")) {
    e.preventDefault();
    const idxAttr = (e.target as HTMLElement).getAttribute("data-idx");
    if (idxAttr !== null) {
      removeTag(Number(idxAttr));
    }
  }
}

function resetEditorFields() {
  editorContent.value = "";
  editorTitle.value = "";
  editorStatus.value = "draft";
  editorVersionId.value = null;
  editorTags.value = [];
  activeHeading.value = "";
}

async function loadDoc() {
  if (!docId.value) return;
  docLoading.value = true;
  docNotFound.value = false;
  resetEditorFields();
  try {
    await fetchDoc(docId.value);
    if (currentDoc.value) {
      editorContent.value = currentDoc.value.content || "";
      editorTitle.value = currentDoc.value.title || "";
      editorStatus.value = currentDoc.value.status || "draft";
      editorVersionId.value = currentDoc.value.versionId || null;
      editorTags.value = currentDoc.value.tags ? [...currentDoc.value.tags] : [];
    } else {
      docNotFound.value = true;
    }
  } catch {
    docNotFound.value = true;
  } finally {
    docLoading.value = false;
  }
}

onMounted(() => {
  $page.setTitle("Technical Editor");
  loadDoc();
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("keydown", onTagRemoveKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("keydown", onTagRemoveKeydown);
  if (toastTimer) clearTimeout(toastTimer);
});

watch(() => docId.value, () => {
  loadDoc();
});

const appName = computed(() => currentDoc.value?.app?.name || "Unbound");
const statusOptions = ["Draft", "In Review", "Published", "Archived"];
const lastModified = computed(() => {
  if (!currentDoc.value?.updatedAt) return "";
  const d = new Date(currentDoc.value.updatedAt);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
});
</script>

<template>
  <div class="editor-page">
    <header class="topbar">
      <div class="flex-gap-md">
        <button
          type="button"
          class="btn btn-ghost back-btn"
          title="Back to docs"
          @click="router.push('/docs-editor')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Technical Editor</h1>
        <span class="pill pill-blue">{{ appName }}</span>
      </div>
      <div class="flex-gap-sm">
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ active: previewOnly }"
          @click="togglePreview"
        >
          {{ previewOnly ? "Editor" : "Preview" }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isSaving"
          @click="saveDraft"
        >
          <span v-if="isSaving">Saving…</span>
          <span v-else>Save Draft</span>
        </button>
        <button type="button" class="btn btn-primary" @click="doPublish">
          Publish
        </button>
      </div>
    </header>

    <main class="content-area">
      <!-- Loading state -->
      <div v-if="docLoading" class="editor-loading">
        <div class="skeleton-pane" style="width: 220px; height: 100%;">
          <div class="skeleton-title" />
          <div v-for="n in 8" :key="n" class="skeleton-line" />
        </div>
        <div class="skeleton-pane" style="flex: 1; height: 100%;">
          <div class="skeleton-toolbar">
            <div v-for="n in 10" :key="n" class="skeleton-chip" />
          </div>
          <div v-for="n in 24" :key="n" class="skeleton-line" />
        </div>
        <div class="skeleton-pane" style="width: 280px; height: 100%;">
          <div class="skeleton-title" />
          <div v-for="n in 6" :key="n" class="skeleton-field" />
        </div>
      </div>

      <!-- Not found state -->
      <div v-else-if="docNotFound" class="not-found">
        <h2>Doc not found</h2>
        <p>The document you are looking for does not exist or has been deleted.</p>
        <button type="button" class="btn btn-primary" @click="router.push('/docs-editor')">
          Back to Docs
        </button>
      </div>

      <div v-else class="doc-shell" :class="{ 'preview-only': previewOnly }">
        <!-- Outline -->
        <div v-if="!previewOnly" class="outline-pane">
          <div class="outline-title">Document Outline</div>
          <ul class="outline-tree" role="list">
            <li
              v-for="(h, idx) in headings"
              :key="idx"
              :class="{ indent: h.level > 1, active: activeHeading === h.text }"
              role="listitem"
              tabindex="0"
              @click="scrollToHeading(h.text)"
              @keydown.enter="scrollToHeading(h.text)"
              @keydown.space.prevent="scrollToHeading(h.text)"
            >
              {{ h.text }}
            </li>
            <li v-if="headings.length === 0" class="indent" style="opacity:0.6;">
              No headings yet
            </li>
          </ul>
        </div>

        <!-- Editor -->
        <div class="editor-pane">
          <div class="toolbar">
            <button
              type="button"
              class="tool-btn"
              title="Heading 1"
              @click="wrapText('# ')"
            >
              H1
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Heading 2"
              @click="wrapText('## ')"
            >
              H2
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Heading 3"
              @click="wrapText('### ')"
            >
              H3
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Bold"
              @click="wrapText('**', '**')"
            >
              B
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Italic"
              @click="wrapText('*', '*')"
            >
              I
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Inline code"
              @click="wrapText('`', '`')"
            >
              `code`
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Code block"
              @click="wrapText('```\n', '\n```')"
            >
              ```
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Bullet list"
              @click="insertLine('- ')"
            >
              • list
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Numbered list"
              @click="insertLine('1. ')"
            >
              1.
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Task list"
              @click="insertLine('- [ ] ')"
            >
              []
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Link"
              @click="wrapText('[', ']()')"
            >
              link
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Image"
              @click="wrapText('![alt text](', ')')"
            >
              img
            </button>
            <button
              type="button"
              class="tool-btn"
              title="Table"
              @click="insertTable"
            >
              table
            </button>
          </div>
          <div class="pane-body">
            <textarea
              v-if="!previewOnly"
              ref="textareaRef"
              v-model="editorContent"
              class="textarea"
              spellcheck="false"
            />
            <div
              v-else
              ref="previewRef"
              class="preview-body"
              v-html="renderedHtml"
            />
          </div>
        </div>

        <!-- Properties -->
        <div v-if="!previewOnly" class="props-pane">
          <div class="props-title">Document Properties</div>
          <div class="field">
            <label for="docTitle">Title</label>
            <input
              id="docTitle"
              v-model="editorTitle"
              class="input"
            />
          </div>
          <div class="field">
            <label for="docVersion">Bound Version</label>
            <select
              id="docVersion"
              v-model="editorVersionId"
              class="select"
            >
              <option :value="null">Unbound (latest)</option>
              <option
                v-for="v in currentDoc?.appVersions || []"
                :key="v.id"
                :value="v.id"
              >
                {{ v.version }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="docStatus">Status</label>
            <select id="docStatus" v-model="editorStatus" class="select">
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div class="field">
            <label>Tags</label>
            <div
              class="tag-input"
              :class="{ 'tag-input-editing': tagInputVisible }"
            >
              <span
                v-for="(tag, idx) in editorTags"
                :key="tag"
                class="tag"
              >
                {{ tag }}
                <span
                  class="tag-remove"
                  tabindex="0"
                  :data-idx="idx"
                  :aria-label="`Remove tag ${tag}`"
                  @click="removeTag(idx)"
                  @keydown.enter.prevent="removeTag(idx)"
                >
                  ×
                </span>
              </span>
              <button
                v-if="!tagInputVisible"
                type="button"
                class="tag-add"
                @click="startAddTag"
              >
                + Add tag
              </button>
              <input
                v-else
                id="tagInputField"
                v-model="tagInputValue"
                type="text"
                placeholder="Tag name…"
                @blur="finishAddTag"
                @keydown="onTagKeydown"
              />
            </div>
          </div>
          <div class="field">
            <label for="docAuthor">Author</label>
            <input
              id="docAuthor"
              class="input"
              :value="currentDoc?.author || ''"
              readonly
            />
          </div>
          <div class="field">
            <label for="docModified">Last Modified</label>
            <input
              id="docModified"
              class="input num"
              :value="lastModified"
              readonly
            />
          </div>
          <div style="margin-top: 8px">
            <button
              type="button"
              class="btn btn-secondary"
              style="width: 100%"
              @click="generatePDF"
            >
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">
      {{ toastMsg }}
    </div>

    <!-- Shortcuts hint -->
    <div class="shortcuts-hint" :class="{ show: shortcutsVisible }">
      <strong>Keyboard shortcuts</strong><br />
      Ctrl+S — Save draft · Ctrl+P — Preview · Ctrl+? — Show shortcuts
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  --bg: oklch(98% 0.004 250);
  --surface: oklch(100% 0 0);
  --fg: oklch(20% 0.02 250);
  --muted: oklch(55% 0.015 250);
  --border: oklch(90% 0.006 250);
  --accent: oklch(55% 0.16 25);
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 6%, transparent);
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --radius: 8px;
  --radius-lg: 12px;
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
  margin: -32px -32px 0;
}
.topbar h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}

.back-btn {
  padding: 6px;
}

.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}
.flex-gap-sm {
  display: flex;
  gap: 8px;
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
}

.doc-shell {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
.doc-shell.preview-only {
  grid-template-columns: 0fr 1fr 0fr;
}
.doc-shell.preview-only .outline-pane {
  display: none;
}
.doc-shell.preview-only .props-pane {
  display: none;
}
.doc-shell.preview-only .editor-pane {
  grid-column: 1 / -1;
}
@media (max-width: 1100px) {
  .doc-shell {
    grid-template-columns: 1fr;
  }
  .doc-shell .outline-pane,
  .doc-shell .props-pane {
    display: none;
  }
}

.outline-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  overflow: auto;
}
.outline-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 12px;
  font-weight: 500;
}
.outline-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}
.outline-tree li {
  padding: 6px 8px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  outline: none;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.outline-tree li:focus-visible {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}
.outline-tree li:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.outline-tree li.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.outline-tree .indent {
  padding-left: 20px;
}

.editor-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
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
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
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
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.tool-btn:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.tool-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.tool-btn:active {
  background: color-mix(in oklch, var(--fg-soft) 70%, transparent);
  transform: scale(0.96);
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
  color: var(--fg);
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
  margin: 16px 0 8px;
  font-weight: 600;
}
.preview-body :deep(ul),
.preview-body :deep(ol) {
  padding-left: 20px;
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
.preview-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
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
.preview-body :deep(blockquote) {
  border-left: 3px solid var(--border);
  margin: 12px 0;
  padding-left: 16px;
  color: var(--muted);
}
.preview-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}
.preview-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius);
}
.preview-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.preview-body :deep(input[type="checkbox"]) {
  margin-right: 6px;
}

.props-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  overflow: auto;
}
.props-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 16px;
  font-weight: 500;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.field label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
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
    box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.input:focus,
.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input[readonly] {
  cursor: default;
  opacity: 0.7;
}
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  font-size: 12px;
  cursor: default;
}
.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--accent) 20%, transparent);
  color: var(--accent);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  border: none;
  padding: 0;
  transition: background 0.1s;
}
.tag-remove:hover {
  background: var(--accent);
  color: var(--surface);
}
.tag-add {
  color: var(--muted);
  font-size: 12px;
  padding: 3px 4px;
  cursor: pointer;
  border: none;
  background: transparent;
}
.tag-add:hover {
  color: var(--fg);
}
.tag-input-editing {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.tag-input input {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--fg);
  outline: none;
  width: 100px;
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

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
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.toast.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.shortcuts-hint {
  position: fixed;
  bottom: 24px;
  left: 32px;
  z-index: 199;
  background: var(--surface);
  color: var(--muted);
  padding: 8px 14px;
  border-radius: var(--radius);
  font-size: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px color-mix(in oklch, var(--fg) 8%, transparent);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.shortcuts-hint.show {
  opacity: 1;
  transform: translateY(0);
}

.editor-loading {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
.skeleton-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton-title {
  height: 14px;
  width: 60%;
  background: var(--border);
  border-radius: 4px;
  margin-bottom: 6px;
}
.skeleton-line {
  height: 12px;
  width: 100%;
  background: var(--border);
  border-radius: 4px;
  opacity: 0.7;
}
.skeleton-line:nth-child(3n) { width: 75%; }
.skeleton-line:nth-child(3n + 1) { width: 90%; }
.skeleton-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.skeleton-chip {
  height: 26px;
  width: 36px;
  background: var(--border);
  border-radius: 4px;
}
.skeleton-field {
  height: 32px;
  width: 100%;
  background: var(--border);
  border-radius: var(--radius);
  opacity: 0.6;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  text-align: center;
  color: var(--muted);
}
.not-found h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}
.not-found p {
  margin: 0;
  font-size: 14px;
  max-width: 400px;
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .shortcuts-hint,
  .btn,
  .tool-btn {
    transition: none !important;
  }
}
</style>
