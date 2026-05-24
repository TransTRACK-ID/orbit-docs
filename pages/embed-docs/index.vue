<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { EmbedDocItem } from "~/composables/useEmbedDocs";

definePageMeta({
  auth: {
    required: true,
  },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Embed Docs");
});

const {
  embedDocs,
  isLoading,
  search,
  fetchEmbedDocs,
  createEmbedDoc,
  deleteEmbedDoc,
} = useEmbedDocs();
const { apps, fetchApps } = useApps();

onMounted(() => {
  fetchEmbedDocs();
  fetchApps();
});

const showCreateModal = ref(false);
const createForm = reactive({
  title: "",
  appId: "",
  subtitle: "",
  content: "",
  status: "draft",
  author: "",
});
const createTitleError = ref(false);

function openCreateModal() {
  showCreateModal.value = true;
  createTitleError.value = false;
  createForm.title = "";
  createForm.appId = "";
  createForm.subtitle = "";
  createForm.content = "";
  createForm.status = "draft";
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
    const doc = await createEmbedDoc({
      title: createForm.title.trim(),
      appId: createForm.appId || undefined,
      subtitle: createForm.subtitle,
      content: createForm.content,
      status: createForm.status,
      author: createForm.author || undefined,
    });
    closeCreateModal();
    await navigateTo(`/embed-docs/${doc.id}`);
  } catch {
    // Error toast shown by composable
  }
}

const docToDelete = ref<EmbedDocItem | null>(null);

function confirmDelete(doc: EmbedDocItem) {
  docToDelete.value = doc;
}

async function doDelete() {
  if (!docToDelete.value) return;
  try {
    await deleteEmbedDoc(docToDelete.value.id);
    docToDelete.value = null;
  } catch {
    // Error toast shown by composable
  }
}

function onSearch() {
  fetchEmbedDocs();
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
  published: "pill-green",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
</script>

<template>
  <div class="embed-docs-page">
    <header class="topbar">
      <h1>Embed Docs</h1>
      <div style="display:flex;align-items:center;gap:16px;">
        <input
          v-model="search"
          class="search"
          placeholder="Search embed docs…"
          aria-label="Search embed docs"
          @input="onSearch"
        />
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Embed Doc
        </button>
      </div>
    </header>

    <div v-if="isLoading" class="grid-3">
      <div v-for="n in 3" :key="n" class="card" style="height: 140px">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="embedDocs.length === 0" class="empty-state">
      <p>No embed docs found.</p>
      <button type="button" class="btn btn-primary" style="margin-top:12px;" @click="openCreateModal">
        Create your first embed doc
      </button>
    </div>

    <div v-else class="grid-3">
      <div v-for="doc in embedDocs" :key="doc.id" class="card">
        <div class="card-head">
          <div>
            <div class="card-title">{{ doc.title }}</div>
            <div class="card-meta">
              Updated {{ timeAgo(doc.updatedAt) }}
              <span v-if="doc.app">· {{ doc.app.name }}</span>
            </div>
          </div>
          <div class="card-actions">
            <span class="pill" :class="statusClass[doc.status] || 'pill-blue'">
              {{ statusLabel[doc.status] || doc.status }}
            </span>
          </div>
        </div>
        <div v-if="doc.subtitle" style="color:var(--muted);font-size:13px;margin-top:4px;">
          {{ doc.subtitle }}
        </div>
        <div class="card-foot">
          <span style="color:var(--muted);font-size:12px;">{{ doc.author || 'Unknown' }}</span>
          <div class="flex-gap-sm">
            <button type="button" class="btn btn-ghost btn-sm" @click="confirmDelete(doc)">
              Delete
            </button>
            <NuxtLink :to="`/embed-docs/${doc.id}`" class="btn btn-ghost btn-sm">
              Edit &rarr;
            </NuxtLink>
            <NuxtLink
              v-if="doc.status === 'published'"
              :to="`/embed-docs/view?slug=${doc.slug}`"
              target="_blank"
              class="btn btn-ghost btn-sm"
            >
              View
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New Embed Doc</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="embedTitle">Title</label>
              <input
                id="embedTitle"
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
              <label for="embedApp">App</label>
              <select id="embedApp" v-model="createForm.appId">
                <option value="">Unbound</option>
                <option v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="embedSubtitle">Subtitle <span class="opt">(optional)</span></label>
              <input id="embedSubtitle" v-model="createForm.subtitle" type="text" placeholder="Short description" />
            </div>
            <div class="form-group">
              <label for="embedAuthor">Author</label>
              <input id="embedAuthor" v-model="createForm.author" type="text" placeholder="Your name" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Create Embed Doc
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!docToDelete }" @click.self="docToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Embed Doc</h2>
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
.embed-docs-page {
  /* Inherits global semantic tokens */
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

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) {
  .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
  box-shadow: 0 1px 3px var(--fg-soft);
}
.card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
}
.card-meta {
  color: var(--muted);
  font-size: 13px;
  margin-top: 4px;
}
.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
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
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}
.pill-muted {
  background: color-mix(in oklch, var(--muted) 12%, transparent);
  color: var(--muted);
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
.btn-danger {
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}
.btn-danger:hover {
  background: oklch(50% 0.18 25);
}

.flex-gap-sm {
  display: flex;
  gap: 8px;
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
.form-group label .opt {
  color: var(--muted);
  font-weight: 400;
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

@media (prefers-reduced-motion: reduce) {
  .card,
  .modal-overlay,
  .modal,
  .btn {
    transition: none !important;
  }
}
</style>
