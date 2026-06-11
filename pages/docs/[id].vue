<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";

definePageMeta({
  auth: true,
});

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const docId = computed(() => route.params.id as string);

const {
  currentDoc,
  docVersions,
  isLoading,
  isSaving,
  isLoadingVersions,
  fetchDoc,
  updateDoc,
  publishDoc,
  fetchDocVersions,
  restoreDocVersion,
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
const chatOpen = ref(false);
const rightSidebarTab = ref<'properties' | 'versions'>('properties');
const restoreConfirmVisible = ref(false);
const versionToRestore = ref<any>(null);
const isRestoring = ref(false);

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
  await fetchDocVersions(docId.value);
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

const previewRef = ref<{ container: HTMLElement | null } | null>(null);

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
  let scrolled = false;
  // Scroll in preview pane if visible
  const preview = previewRef.value?.container;
  if (preview) {
    const headings = preview.querySelectorAll("h2, h3");
    for (const h of headings) {
      if (h.textContent?.trim() === text) {
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        scrolled = true;
        break;
      }
    }
  }
  // Fallback: scroll inside the editor pane body
  if (!scrolled) {
    const paneBody = document.querySelector(".editor-pane .pane-body");
    if (paneBody) {
      const headings = paneBody.querySelectorAll(".ce-header");
      for (const h of headings) {
        if (h.textContent?.trim() === text) {
          h.scrollIntoView({ behavior: "smooth", block: "start" });
          scrolled = true;
          break;
        }
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

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

function switchSidebarTab(tab: 'properties' | 'versions') {
  rightSidebarTab.value = tab;
}

function restoreVersion(version: any) {
  versionToRestore.value = version;
  restoreConfirmVisible.value = true;
}

async function confirmRestore() {
  if (!docId.value || !versionToRestore.value) return;
  isRestoring.value = true;
  try {
    await restoreDocVersion(docId.value, versionToRestore.value.id);
    await loadDoc();
    showToast("Version restored successfully");
  } catch {
    showToast("Failed to restore version");
  } finally {
    isRestoring.value = false;
    restoreConfirmVisible.value = false;
    versionToRestore.value = null;
  }
}

function cancelRestore() {
  restoreConfirmVisible.value = false;
  versionToRestore.value = null;
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
    await fetchDocVersions(docId.value);
  } catch {
    docNotFound.value = true;
  } finally {
    docLoading.value = false;
  }
}

onMounted(() => {
  $page.setTitle("Doc Editor");
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
          @click="router.push('/docs')"
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
          :class="{ active: chatOpen }"
          @click="toggleChat"
        >
          AI Chat
        </button>
        <NuxtLink
          v-if="editorStatus === 'published'"
          :to="`/p/${docId}`"
          target="_blank"
          class="btn btn-ghost"
        >
          Public View
        </NuxtLink>
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
          <div class="skeleton-tabs">
            <div v-for="n in 2" :key="n" class="skeleton-tab" />
          </div>
          <div class="skeleton-title" />
          <div v-for="n in 6" :key="n" class="skeleton-field" />
        </div>
      </div>

      <!-- Not found state -->
      <div v-else-if="docNotFound" class="not-found">
        <h2>Doc not found</h2>
        <p>The document you are looking for does not exist or has been deleted.</p>
        <button type="button" class="btn btn-primary" @click="router.push('/docs')">
          Back to Docs
        </button>
      </div>

      <div v-else class="doc-shell" :class="{ 'preview-only': previewOnly }">
        <!-- Outline -->
        <div v-if="!previewOnly" class="outline-pane">
          <div class="outline-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span class="outline-title">Document Outline</span>
          </div>
          <ul class="outline-tree" role="list">
            <li
              v-for="(h, idx) in headings"
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
            <li v-if="headings.length === 0" class="outline-empty">
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
          <div class="pane-body" style="overflow:visible;">
            <ClientOnly>
              <EditorJs
                v-if="!previewOnly"
                v-model="editorContent"
                placeholder="Write your technical documentation..."
                style="height:100%;"
              />
              <MermaidHtml
                v-else
                ref="previewRef"
                :html="renderedHtml"
                class="preview-body"
              />
            </ClientOnly>
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
              <span v-if="docVersions.length > 0" class="tab-badge">{{ docVersions.length }}</span>
            </button>
          </div>

          <div class="sidebar-tab-panel">
            <Transition name="tab-fade" mode="out-in">
              <!-- Properties Panel -->
              <div v-if="rightSidebarTab === 'properties'" key="properties" class="props-panel">
              <div class="props-section">
                <div class="props-section-label">Document</div>
                <div class="field">
                  <label for="docTitle">Title</label>
                  <input
                    id="docTitle"
                    v-model="editorTitle"
                    class="input"
                    placeholder="Enter document title"
                  />
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
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </span>
                    </span>
                    <button
                      v-if="!tagInputVisible"
                      type="button"
                      class="tag-add"
                      @click="startAddTag"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                      Add
                    </button>
                    <input
                      v-else
                      id="tagInputField"
                      v-model="tagInputValue"
                      type="text"
                      placeholder="Tag name"
                      @blur="finishAddTag"
                      @keydown="onTagKeydown"
                    />
                  </div>
                </div>
              </div>

              <div class="props-section">
                <div class="props-section-label">Version</div>
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
              </div>

              <div class="props-section">
                <div class="props-section-label">Metadata</div>
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
              </div>

              <div class="props-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  style="width: 100%"
                  @click="generatePDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Generate PDF
                </button>
              </div>
            </div>

            <!-- Versions Panel -->
            <div v-else key="versions" class="versions-panel">
              <DocsVersionTimeline
                :versions="docVersions"
                :is-loading="isLoadingVersions"
                @restore="restoreVersion"
              />
            </div>
            </Transition>
          </div>
        </div>

        <!-- AI Chat -->
        <div v-if="chatOpen && !previewOnly" class="chat-pane">
          <DocsChatWidget
            :doc-id="docId"
            @close="chatOpen = false"
          />
        </div>
      </div>
    </main>

    <!-- Restore Confirmation Dialog -->
    <div v-if="restoreConfirmVisible" class="modal-overlay" @click="cancelRestore">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3>Restore Version</h3>
          <p class="modal-desc">
            This will replace the current document with version
            <strong>{{ versionToRestore?.version }}</strong>.
            The current state will be automatically saved as a new version before restoring.
          </p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="cancelRestore">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="isRestoring"
            @click="confirmRestore"
          >
            <span v-if="isRestoring">Restoring…</span>
            <span v-else>Restore</span>
          </button>
        </div>
      </div>
    </div>

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
  /* Inherits global semantic tokens from :root — no local overrides so dark mode works */
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
.doc-shell.preview-only .right-sidebar {
  display: none;
}
.doc-shell.preview-only .chat-pane {
  display: none;
}
.doc-shell.preview-only .editor-pane {
  grid-column: 1 / -1;
}
.doc-shell .chat-pane {
  grid-column: 1 / -1;
  min-height: 400px;
}
@media (max-width: 1400px) {
  .doc-shell {
    grid-template-columns: 220px 1fr 280px;
  }
}
@media (max-width: 1100px) {
  .doc-shell {
    grid-template-columns: 1fr;
  }
  .doc-shell .outline-pane,
  .doc-shell .right-sidebar {
    display: none;
  }
  .doc-shell .chat-pane {
    grid-column: auto;
    min-height: 400px;
  }
}

.outline-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.outline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
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
.preview-body :deep(ul) {
  padding-left: 20px;
  list-style-type: disc;
}
.preview-body :deep(ol) {
  padding-left: 20px;
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

.right-sidebar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 280px;
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

.versions-panel :deep(.version-timeline) {
  border: none;
  padding: 0;
  background: transparent;
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

.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  min-height: 36px;
  align-items: center;
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
  font-weight: 500;
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
  transition: background 0.1s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag-remove:hover {
  background: var(--accent);
  color: var(--surface);
}

.tag-remove:active {
  transform: scale(0.9);
}

.tag-remove:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.tag-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: transparent;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag-add:hover {
  color: var(--fg);
  border-color: var(--muted);
  background: var(--fg-soft);
}

.tag-add:active {
  transform: scale(0.96);
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
  padding: 2px;
}

.props-actions {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.chat-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-width: 320px;
  display: flex;
  flex-direction: column;
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

.skeleton-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.skeleton-tab {
  height: 24px;
  width: 80px;
  background: var(--border);
  border-radius: 4px;
  opacity: 0.5;
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

/* Tab transitions */
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

/* Modal dialog */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: color-mix(in oklch, var(--fg) 25%, transparent);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: modal-in 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modal-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-dialog {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 16px 48px color-mix(in oklch, var(--fg) 12%, transparent);
  animation: dialog-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
}

.modal-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
}

.modal-desc strong {
  color: var(--fg);
  font-weight: 600;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Focus-visible states */
.sidebar-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: var(--radius);
}

.timeline-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tag-add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .shortcuts-hint,
  .btn,
  .tool-btn,
  .sidebar-tab,
  .timeline-btn,
  .tag-add,
  .tag-remove,
  .input,
  .select,
  .tab-fade-enter-active,
  .tab-fade-leave-active,
  .modal-overlay,
  .modal-dialog {
    transition: none !important;
    animation: none !important;
  }
}
</style>
