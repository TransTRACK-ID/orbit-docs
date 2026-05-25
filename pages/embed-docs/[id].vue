<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { EmbedNavItem, EmbedDocDetail } from "~/composables/useEmbedDocs";

definePageMeta({
  auth: true,
});

const route = useRoute();
const router = useRouter();
const $page = usePageStore();

const docId = computed(() => route.params.id as string);

const {
  currentEmbedDoc,
  isLoading,
  isSaving,
  fetchEmbedDoc,
  updateEmbedDoc,
} = useEmbedDocs();
const { apps, fetchApps } = useApps();

onBeforeMount(() => {
  $page.setTitle("Edit Embed Doc");
});

onMounted(() => {
  fetchApps();
  loadDoc();
});

const editorTitle = ref("");
const editorSlug = ref("");
const editorSubtitle = ref("");
const editorAppId = ref("");
const editorVersionId = ref<string | null>(null);
const editorStatus = ref("draft");
const editorContent = ref("");
const editorNavItems = ref<EmbedNavItem[]>([]);
const editorAuthor = ref("");
const toastMsg = ref("");
const toastVisible = ref(false);
const previewOnly = ref(false);
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

async function loadDoc() {
  try {
    const data = await fetchEmbedDoc(docId.value);
    editorTitle.value = data.title;
    editorSlug.value = data.slug;
    editorSubtitle.value = data.subtitle || "";
    editorAppId.value = data.appId || "";
    editorVersionId.value = data.versionId || null;
    editorStatus.value = data.status;
    editorContent.value = data.content || "";
    editorNavItems.value = data.navItems || [];
    editorAuthor.value = data.author || "";
  } catch (e: any) {
    if (e?.statusCode === 404) {
      docNotFound.value = true;
    }
  }
}

async function saveDoc() {
  if (!docId.value) return;
  await updateEmbedDoc(docId.value, {
    title: editorTitle.value,
    slug: editorSlug.value,
    subtitle: editorSubtitle.value,
    appId: editorAppId.value || undefined,
    versionId: editorVersionId.value ?? undefined,
    status: editorStatus.value,
    content: editorContent.value,
    navItems: editorNavItems.value,
    author: editorAuthor.value || undefined,
  });
}

async function doPublish() {
  editorStatus.value = "published";
  await saveDoc();
  showToast("Published successfully");
}

function addNavItem(type: "section" | "indent") {
  editorNavItems.value.push({ type, text: "" });
}

function removeNavItem(index: number) {
  editorNavItems.value.splice(index, 1);
}

function moveNavItem(index: number, direction: -1 | 1) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= editorNavItems.value.length) return;
  const temp = editorNavItems.value[index];
  editorNavItems.value[index] = editorNavItems.value[newIndex];
  editorNavItems.value[newIndex] = temp;
}

const appVersions = computed(() => {
  return currentEmbedDoc.value?.appVersions || [];
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generateSlug() {
  if (editorTitle.value) {
    editorSlug.value = slugify(editorTitle.value);
  }
}
</script>

<template>
  <div class="embed-editor-page">
    <div v-if="docNotFound" class="empty-state">
      <p>Embed doc not found.</p>
      <NuxtLink to="/embed-docs" class="btn btn-primary" style="margin-top:12px;">
        Back to Embed Docs
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <header class="toolbar">
        <div class="toolbar-left">
          <NuxtLink to="/embed-docs" class="btn btn-ghost btn-sm">
            <IconsArrowLeft size="14" />
            Back
          </NuxtLink>
          <div class="toolbar-title">
            <input
              v-model="editorTitle"
              class="title-input"
              placeholder="Doc title"
              @blur="generateSlug"
            />
          </div>
        </div>
        <div class="toolbar-right">
          <select v-model="editorStatus" class="status-select">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button type="button" class="btn btn-secondary btn-sm" @click="previewOnly = !previewOnly">
            {{ previewOnly ? 'Edit' : 'Preview' }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="isSaving" @click="saveDoc">
            <span v-if="isSaving">Saving…</span>
            <span v-else>Save</span>
          </button>
          <button
            v-if="editorStatus !== 'published'"
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="isSaving"
            @click="doPublish"
          >
            Publish
          </button>
        </div>
      </header>

      <!-- Toast -->
      <div class="toast-bar" :class="{ show: toastVisible }">
        {{ toastMsg }}
      </div>

      <div class="editor-layout">
        <!-- Sidebar config -->
        <aside v-if="!previewOnly" class="config-panel">
          <div class="panel-section">
            <h3>Metadata</h3>
            <div class="form-group">
              <label>Slug</label>
              <input v-model="editorSlug" type="text" placeholder="doc-slug" />
            </div>
            <div class="form-group">
              <label>Subtitle</label>
              <input v-model="editorSubtitle" type="text" placeholder="Short description" />
            </div>
            <div class="form-group">
              <label>App</label>
              <select v-model="editorAppId">
                <option value="">None</option>
                <option v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Version</label>
              <select v-model="editorVersionId">
                <option :value="null">Latest</option>
                <option v-for="v in appVersions" :key="v.id" :value="v.id">
                  {{ v.version }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Author</label>
              <input v-model="editorAuthor" type="text" placeholder="Author name" />
            </div>
          </div>

          <div class="panel-section">
            <div class="row-between">
              <h3>Navigation</h3>
              <div style="display:flex;gap:6px;">
                <button type="button" class="btn btn-ghost btn-sm" @click="addNavItem('section')">
                  + Section
                </button>
                <button type="button" class="btn btn-ghost btn-sm" @click="addNavItem('indent')">
                  + Item
                </button>
              </div>
            </div>
            <div v-if="editorNavItems.length === 0" style="color:var(--muted);font-size:13px;padding:8px 0;">
              No nav items. Add sections and items above.
            </div>
            <div
              v-for="(item, index) in editorNavItems"
              :key="index"
              class="nav-item-row"
            >
              <span class="nav-item-type">{{ item.type }}</span>
              <input
                v-model="item.text"
                type="text"
                :placeholder="item.type === 'section' ? 'Section title' : 'Item text'"
                style="flex:1;"
              />
              <button type="button" class="btn btn-ghost btn-sm" title="Move up" @click="moveNavItem(index, -1)">
                ▲
              </button>
              <button type="button" class="btn btn-ghost btn-sm" title="Move down" @click="moveNavItem(index, 1)">
                ▼
              </button>
              <button type="button" class="btn btn-ghost btn-sm" title="Remove" @click="removeNavItem(index)">
                ✕
              </button>
            </div>
          </div>
        </aside>

        <!-- Main editor -->
        <main class="editor-main">
          <div v-if="!previewOnly" class="editor-pane">
            <label class="pane-label">Content (HTML)</label>
            <textarea
              v-model="editorContent"
              class="content-textarea"
              placeholder="<h2 id='getting-started'>Getting Started</h2><p>Your documentation content...</p>"
            />
          </div>
          <div v-else class="preview-pane">
            <div class="flex-gap-sm" style="margin-bottom:8px;">
              <span class="pill" :class="editorStatus === 'published' ? 'pill-green' : 'pill-blue'">
                {{ editorStatus === 'published' ? 'Published' : 'Draft' }}
              </span>
              <span class="meta-label num">Updated just now</span>
            </div>
            <div class="doc-body" v-html="editorContent" />
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
.embed-editor-page {
  /* Inherits global tokens */
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.toolbar-title {
  flex: 1;
  min-width: 0;
}
.title-input {
  width: 100%;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius);
  padding: 6px 10px;
  font-family: inherit;
}
.title-input:hover {
  border-color: var(--border);
}
.title-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-select {
  padding: 6px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 13px;
  color: var(--fg);
}

.toast-bar {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 200;
  background: var(--fg);
  color: var(--surface);
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 20%, transparent);
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity .2s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1);
  pointer-events: none;
}
.toast-bar.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.editor-layout {
  display: flex;
  gap: 24px;
  min-height: calc(100vh - 200px);
}

.config-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.panel-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
}
.panel-section h3 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: 0 0 12px;
}

.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--fg);
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 13px;
  color: var(--fg);
}
.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nav-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.nav-item-type {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
  width: 50px;
  flex-shrink: 0;
}

.editor-main {
  flex: 1;
  min-width: 0;
}
.editor-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.pane-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.content-textarea {
  flex: 1;
  width: 100%;
  min-height: 400px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg);
  resize: vertical;
}
.content-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.preview-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px 40px;
  min-height: 400px;
}

.doc-body :deep(h1) {
  font-size: 28px;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
  font-weight: 600;
}
.doc-body :deep(h2) {
  font-size: 20px;
  margin: 32px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}
.doc-body :deep(h3) {
  font-size: 15px;
  margin: 20px 0 10px;
  font-weight: 600;
}
.doc-body :deep(p) {
  margin: 0 0 14px;
  line-height: 1.7;
}
.doc-body :deep(ul), .doc-body :deep(ol) {
  padding-left: 24px;
  margin: 0 0 14px;
}
.doc-body :deep(li) {
  margin: 5px 0;
}
.doc-body :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
}
.doc-body :deep(pre) {
  position: relative;
  background: var(--bg);
  padding: 14px;
  border-radius: var(--radius);
  overflow: auto;
  border: 1px solid var(--border);
  margin: 0 0 14px;
}
.doc-body :deep(pre code) {
  background: none;
  padding: 0;
}
.doc-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 0 0 14px;
}
.doc-body :deep(th), .doc-body :deep(td) {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.doc-body :deep(th) {
  font-weight: 600;
  font-size: 12px;
  color: var(--muted);
}
.doc-body :deep(blockquote) {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 var(--radius) var(--radius) 0;
}
.doc-body :deep(blockquote p) {
  margin: 0;
}
.doc-body :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 28px 0;
}
.doc-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
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
.meta-label {
  font-size: 13px;
  color: var(--muted);
}
.flex-gap-sm {
  display: flex;
  gap: 8px;
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
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
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

@media (max-width: 900px) {
  .editor-layout {
    flex-direction: column;
  }
  .config-panel {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-bar,
  .btn {
    transition: none !important;
  }
}
</style>
