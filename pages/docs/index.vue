<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { DocItem } from "~/composables/useDocs";
import DotsVertical from "~/components/icons/DotsVertical/index.vue";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Docs");
});

const route = useRoute();
const { docs, isLoading, search, fetchDocs, createDoc, deleteDoc } = useDocs();
const { apps, fetchApps } = useApps();

const appFilter = ref((route.query.app as string) || "");

watch(
  () => route.query.app,
  (app) => {
    appFilter.value = (app as string) || "";
  }
);

const appFilterOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

const appOptions = computed(() => [
  { id: "", label: "Unbound (latest)" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

onMounted(async () => {
  await fetchApps();
  await fetchDocs({ appId: appFilter.value });
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("click", onClickOutside);
});

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".actions-menu")) {
    docs.value.forEach((d: any) => (d._showActions = false));
  }
}

watch([search, appFilter], async () => {
  await fetchDocs({ appId: appFilter.value });
});

watch(appFilter, (appId) => {
  createForm.appId = appId;
});

const showCreateModal = ref(false);
const createForm = reactive({
  title: "",
  appId: appFilter.value,
  content: "",
  status: "draft",
  tags: [] as string[],
  author: "",
});
const createTitleError = ref(false);

function openCreateModal() {
  showCreateModal.value = true;
  createTitleError.value = false;
  createForm.title = "";
  createForm.appId = appFilter.value;
  createForm.content = "";
  createForm.status = "draft";
  createForm.tags = [];
  createForm.author = "";
}

function closeCreateModal() {
  showCreateModal.value = false;
  createTitleError.value = false;
}

async function submitCreate() {
  if (!createForm.title.trim()) {
    createTitleError.value = true;
    return;
  }
  createTitleError.value = false;
  try {
    const doc = await createDoc({
      title: createForm.title.trim(),
      appId: createForm.appId || undefined,
      content: createForm.content,
      status: createForm.status,
      tags: createForm.tags,
      author: createForm.author || undefined,
    });
    closeCreateModal();
    await navigateTo(`/docs/${doc.id}`);
  } catch {
    // Error toast shown by createDoc composable
  }
}

const docToDelete = ref<DocItem | null>(null);

function confirmDelete(doc: DocItem) {
  docToDelete.value = doc;
}

async function doDelete() {
  if (!docToDelete.value) return;
  try {
    await deleteDoc(docToDelete.value.id);
    docToDelete.value = null;
  } catch {
    // Error toast shown by deleteDoc composable
  }
}

function onSearch() {
  fetchDocs({ appId: appFilter.value });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    search.value = "";
    appFilter.value = "";
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 604800)} weeks ago`;
}

const statusClass: Record<string, string> = {
  draft: "pill-blue",
  in_review: "pill-amber",
  published: "pill-green",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  published: "Published",
  archived: "Archived",
};

const sourceLabel: Record<string, string> = {
  manual: "",
  generated: "Generated",
};

const sourceClass: Record<string, string> = {
  manual: "",
  generated: "pill-purple",
};
</script>

<template>
  <div class="docs-page">
    <header class="topbar">
      <div class="flex-gap-md">
        <h1>Docs</h1>
        <span class="text-muted-sm">All documentation across apps</span>
      </div>
      <div class="flex-gap-md">
        <input
          v-model="search"
          class="search"
          placeholder="Search docs…"
          aria-label="Search docs"
          @input="onSearch"
        />
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="Filter by app…"
          search-placeholder="Search apps…"
        />
        <NuxtLink to="/docs/generate" class="btn btn-secondary">
          ✦ Generate Docs
        </NuxtLink>
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Doc
        </button>
      </div>
    </header>

    <div v-if="isLoading" class="doc-grid">
      <div v-for="n in 3" :key="n" class="doc-card" style="height: 140px">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="docs.length === 0" class="empty-state">
      <p>No docs found.</p>
      <button type="button" class="btn btn-primary" style="margin-top:12px;" @click="openCreateModal">
        Create your first doc
      </button>
    </div>

    <div v-else class="doc-grid">
      <div v-for="doc in docs" :key="doc.id" class="doc-card">
        <div class="doc-card__header">
          <div class="doc-card__title-group">
            <div class="doc-card__title">{{ doc.title }}</div>
            <div class="doc-card__meta">
              <span class="doc-card__meta-item">Updated {{ timeAgo(doc.updatedAt) }}</span>
              <span v-if="doc.app" class="doc-card__meta-item">{{ doc.app.name }}</span>
            </div>
          </div>
          <div class="flex-gap-sm">
            <span v-if="doc.source === 'generated'" class="pill" :class="sourceClass[doc.source]">
              {{ sourceLabel[doc.source] }}
            </span>
            <span class="pill" :class="statusClass[doc.status] || 'pill-blue'">
              {{ statusLabel[doc.status] || doc.status }}
            </span>
          </div>
        </div>

        <div v-if="doc.tags && doc.tags.length > 0" class="doc-card__tags">
          <span v-for="tag in doc.tags" :key="tag" class="pill pill-accent">{{ tag }}</span>
        </div>

        <div class="doc-card__footer">
          <span class="doc-card__author">{{ doc.author || 'Unknown' }}</span>
          <div class="doc-card__actions">
            <NuxtLink :to="`/docs/${doc.id}`" class="btn btn-primary btn-sm">
              Edit
            </NuxtLink>
            <div class="actions-menu">
              <button type="button" class="btn btn-ghost btn-sm actions-toggle" aria-label="More actions" @click="doc._showActions = !doc._showActions">
                <DotsVertical />
              </button>
              <div v-if="doc._showActions" class="actions-dropdown" @click.stop>
                <NuxtLink
                  v-if="doc.status === 'published'"
                  :to="`/p/${doc.id}`"
                  target="_blank"
                  class="actions-item"
                  @click="doc._showActions = false"
                >
                  Public View
                </NuxtLink>
                <button type="button" class="actions-item actions-danger" @click="doc._showActions = false; confirmDelete(doc)">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New Doc</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="docTitle">Title</label>
              <input
                id="docTitle"
                v-model="createForm.title"
                type="text"
                placeholder="e.g. API Gateway — Developer Docs"
                required
                :class="{ 'input-error': createTitleError }"
                @input="createTitleError = false"
              />
              <span class="error-msg" :class="{ show: createTitleError }">
                Title is required
              </span>
            </div>
            <div class="form-group">
              <label for="docApp">App</label>
              <GeneralSearchableDropdown
                id="docApp"
                v-model="createForm.appId"
                :options="appOptions"
                placeholder="Select app…"
                search-placeholder="Search apps…"
              />
            </div>
            <div class="form-group">
              <label for="docAuthor">Author</label>
              <AppOwnerSelect id="docAuthor" v-model="createForm.author" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Create Doc
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!docToDelete }" @click.self="docToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Doc</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="docToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--muted);">
            Are you sure you want to delete <strong>{{ docToDelete?.title }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="docToDelete = null">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" @click="doDelete">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.docs-page {
  /* Inherits global semantic tokens from :root — no local overrides so dark mode works */
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.search {
  width: 320px;
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

/* ── Spacing scale ─────────────────────────────────────────────── */
.docs-page {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
}

/* ── Doc grid ───────────────────────────────────────────────── */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-lg);
  align-items: stretch;
}

/* ── Doc card ───────────────────────────────────────────────── */
.doc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.doc-card:hover {
  box-shadow: 0 4px 12px color-mix(in oklch, var(--fg) 8%, transparent);
}

/* ── Header: title + meta ───────────────────────────────────── */
.doc-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}

.doc-card__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  flex: 1;
}

.doc-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.doc-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  color: var(--muted);
  font-size: 12px;
}

.doc-card__meta-item + .doc-card__meta-item::before {
  content: "·";
  margin-right: var(--space-xs);
  color: var(--muted);
  opacity: 0.6;
}

/* ── Tags ───────────────────────────────────────────────────── */
.doc-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-md);
}

/* ── Footer: author + actions ───────────────────────────────── */
.doc-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-top: auto;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.doc-card__author {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.01em;
}
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}
.pill-muted {
  background: color-mix(in oklch, var(--muted) 12%, transparent);
  color: var(--muted);
}
.pill-purple {
  background: color-mix(in oklch, oklch(55% 0.2 295) 12%, transparent);
  color: oklch(50% 0.16 295);
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
.actions-menu {
  position: relative;
}
.actions-toggle {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--muted);
  background: transparent;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.actions-toggle:hover {
  border-color: var(--fg);
  color: var(--fg);
  background: var(--surface);
}
.actions-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 10%, transparent);
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 4px;
  overflow: hidden;
}
.actions-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--fg);
  text-decoration: none;
  border-radius: var(--radius);
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  transition: background 0.15s;
}
.actions-item:hover {
  background: color-mix(in oklch, var(--fg) 7%, transparent);
}
.actions-danger {
  color: oklch(50% 0.16 25);
}
.actions-danger:hover {
  background: color-mix(in oklch, oklch(55% 0.16 25) 10%, transparent);
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
.btn-danger {
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}
.btn-danger:hover {
  background: oklch(50% 0.18 25);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 520px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  transform: translateY(12px) scale(0.98);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open .modal {
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
.modal-body {
  padding: 20px 24px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--fg);
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-error {
  border-color: oklch(55% 0.18 25) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent) !important;
}
.error-msg {
  display: none;
  color: oklch(50% 0.16 25);
  font-size: 12px;
  margin-top: 4px;
}
.error-msg.show {
  display: block;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.flex-gap-sm {
  display: flex;
  gap: 8px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 768px) {
  .search {
    width: 180px;
  }
  .topbar {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .doc-card,
  .modal-overlay,
  .modal,
  .btn {
    transition: none !important;
  }
}
</style>
