<script setup lang="ts">
import { toast } from "vue3-toastify";
import { usePageStore } from "~/store/page";
import type { ChangelogItem } from "~/types";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Changelogs");
});

const {
  changelogs,
  isLoading,
  isCreating,
  fetchChangelogs,
  createChangelog,
  deleteChangelog,
} = useChangelogs();

const { apps, fetchApps } = useApps();

// Search, filter & sort
const route = useRoute();

const searchQuery = ref("");
const statusFilter = ref("");
const appFilter = ref("");
const sortBy = ref<"updatedAt" | "title">("updatedAt");
const sortOrder = ref<"asc" | "desc">("desc");
const showFilterMenu = ref(false);
const showSortMenu = ref(false);

onMounted(async () => {
  await fetchApps();
  const appQuery = route.query.app as string;
  if (appQuery && apps.value.find((a) => a.id === appQuery)) {
    appFilter.value = appQuery;
  }
  fetchChangelogs();
  document.addEventListener("click", onDocClick);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
});

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    !!statusFilter.value ||
    !!appFilter.value
);

const activeSortLabel = computed(() => {
  const labels: Record<string, string> = {
    "updatedAt-desc": "Recently updated",
    "updatedAt-asc": "Oldest first",
    "title-asc": "Title A–Z",
    "title-desc": "Title Z–A",
  };
  return labels[`${sortBy.value}-${sortOrder.value}`] || "Sort";
});

const filteredChangelogs = computed(() => {
  let result = [...changelogs.value];

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.appName && c.appName.toLowerCase().includes(q)) ||
        (c.version && c.version.toLowerCase().includes(q))
    );
  }

  if (statusFilter.value) {
    result = result.filter((c) => c.status === statusFilter.value);
  }

  if (appFilter.value) {
    result = result.filter((c) => c.appId === appFilter.value);
  }

  result.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy.value === "updatedAt") {
      cmp =
        new Date(a.updatedAt || 0).getTime() -
        new Date(b.updatedAt || 0).getTime();
    }
    return sortOrder.value === "asc" ? cmp : -cmp;
  });

  return result;
});

function clearFilters() {
  searchQuery.value = "";
  statusFilter.value = "";
  appFilter.value = "";
}

function setSort(
  field: "updatedAt" | "title",
  order: "asc" | "desc"
) {
  sortBy.value = field;
  sortOrder.value = order;
  showSortMenu.value = false;
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest(".filter-dropdown-wrap")) showFilterMenu.value = false;
  if (!t.closest(".sort-dropdown-wrap")) showSortMenu.value = false;
}

// Create modal
const showCreateModal = ref(false);
const createForm = reactive({
  appId: "",
  title: "",
  content: "",
  status: "draft" as "draft" | "published",
});
const createTitleError = ref(false);

function openCreateModal() {
  showCreateModal.value = true;
  createTitleError.value = false;
  createForm.appId = apps.value[0]?.id || "";
  createForm.title = "";
  createForm.content = "";
  createForm.status = "draft";
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
  if (!createForm.appId) {
    toast.error("Please select an app");
    return;
  }
  createTitleError.value = false;
  await createChangelog({
    appId: createForm.appId,
    title: createForm.title.trim(),
    content: createForm.content,
    status: createForm.status,
  });
  closeCreateModal();
}

// Delete confirmation
const changelogToDelete = ref<ChangelogItem | null>(null);
const isDeletingItem = ref(false);

function confirmDelete(changelog: ChangelogItem) {
  changelogToDelete.value = changelog;
}

async function doDelete() {
  if (!changelogToDelete.value || isDeletingItem.value) return;
  isDeletingItem.value = true;
  try {
    await deleteChangelog(changelogToDelete.value.id);
  } finally {
    changelogToDelete.value = null;
    isDeletingItem.value = false;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  if (diff < 2419200) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2419200)} months ago`;
}

const statusClass: Record<string, string> = {
  draft: "pill-blue",
  published: "pill-green",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Published",
};
</script>

<template>
  <div class="changelogs-page">
    <!-- Topbar -->
    <header class="topbar">
      <h1>Changelogs</h1>
      <div style="display:flex;align-items:center;gap:16px;">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search changelogs…"
          aria-label="Search changelogs"
        />
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Changelog
        </button>
      </div>
    </header>

    <!-- Filters -->
    <div class="row-between" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <h2>Your changelogs</h2>
        <span v-if="hasActiveFilters" class="result-count">
          {{ filteredChangelogs.length }} result{{ filteredChangelogs.length === 1 ? '' : 's' }}
        </span>
      </div>
      <div style="display:flex;gap:8px;">
        <div class="filter-dropdown-wrap" style="position:relative;">
          <button
            class="btn btn-ghost"
            :class="{ active: hasActiveFilters }"
            @click.stop="showFilterMenu = !showFilterMenu"
          >
            Filter
            <span v-if="hasActiveFilters" class="filter-dot" />
          </button>
          <div v-if="showFilterMenu" class="dropdown-menu">
            <div class="dropdown-header">Status</div>
            <div
              class="dropdown-item"
              :class="{ active: !statusFilter }"
              @click="statusFilter = ''"
            >
              <span v-if="!statusFilter" class="check">✓</span>
              <span v-else class="check-placeholder" />
              All statuses
            </div>
            <div
              v-for="s in ['draft','published']"
              :key="s"
              class="dropdown-item"
              :class="{ active: statusFilter === s }"
              @click="statusFilter = s"
            >
              <span v-if="statusFilter === s" class="check">✓</span>
              <span v-else class="check-placeholder" />
              {{ statusLabel[s] }}
            </div>

            <div class="dropdown-divider" />
            <div class="dropdown-header">App</div>
            <div
              class="dropdown-item"
              :class="{ active: !appFilter }"
              @click="appFilter = ''"
            >
              <span v-if="!appFilter" class="check">✓</span>
              <span v-else class="check-placeholder" />
              All apps
            </div>
            <div
              v-for="app in apps"
              :key="app.id"
              class="dropdown-item"
              :class="{ active: appFilter === app.id }"
              @click="appFilter = app.id"
            >
              <span v-if="appFilter === app.id" class="check">✓</span>
              <span v-else class="check-placeholder" />
              {{ app.name }}
            </div>

            <div class="dropdown-divider" />
            <div
              class="dropdown-item"
              style="color:var(--accent);justify-content:center;"
              @click="clearFilters"
            >
              Clear all filters
            </div>
          </div>
        </div>

        <div class="sort-dropdown-wrap" style="position:relative;">
          <button
            class="btn btn-ghost"
            :class="{ active: sortBy !== 'updatedAt' || sortOrder !== 'desc' }"
            @click.stop="showSortMenu = !showSortMenu"
          >
            {{ activeSortLabel }}
          </button>
          <div v-if="showSortMenu" class="dropdown-menu">
            <div
              class="dropdown-item"
              :class="{ active: sortBy === 'updatedAt' && sortOrder === 'desc' }"
              @click="setSort('updatedAt', 'desc')"
            >
              <span v-if="sortBy === 'updatedAt' && sortOrder === 'desc'" class="check">✓</span>
              <span v-else class="check-placeholder" />
              Recently updated
            </div>
            <div
              class="dropdown-item"
              :class="{ active: sortBy === 'updatedAt' && sortOrder === 'asc' }"
              @click="setSort('updatedAt', 'asc')"
            >
              <span v-if="sortBy === 'updatedAt' && sortOrder === 'asc'" class="check">✓</span>
              <span v-else class="check-placeholder" />
              Oldest first
            </div>
            <div
              class="dropdown-item"
              :class="{ active: sortBy === 'title' && sortOrder === 'asc' }"
              @click="setSort('title', 'asc')"
            >
              <span v-if="sortBy === 'title' && sortOrder === 'asc'" class="check">✓</span>
              <span v-else class="check-placeholder" />
              Title A–Z
            </div>
            <div
              class="dropdown-item"
              :class="{ active: sortBy === 'title' && sortOrder === 'desc' }"
              @click="setSort('title', 'desc')"
            >
              <span v-if="sortBy === 'title' && sortOrder === 'desc'" class="check">✓</span>
              <span v-else class="check-placeholder" />
              Title Z–A
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid-3">
      <div v-for="n in 3" :key="n" class="card" style="height: 140px">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredChangelogs.length === 0" class="empty-state">
      <p>No changelogs match your filters.</p>
      <button v-if="hasActiveFilters" class="btn btn-ghost" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <!-- Changelog cards -->
    <div v-else class="grid-3">
      <div v-for="c in filteredChangelogs" :key="c.id" class="card">
        <div class="card-head">
          <div>
            <div class="card-title">{{ c.title }}</div>
            <div class="card-meta">
              {{ c.appName || "Unknown app" }}
              <span v-if="c.version">· v{{ c.version }}</span>
            </div>
          </div>
          <div class="card-actions">
            <span class="pill" :class="statusClass[c.status] || 'pill-blue'">
              {{ statusLabel[c.status] || c.status }}
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span class="text-muted-sm">Updated {{ timeAgo(c.updatedAt) }}</span>
          <span v-if="c.createdBy" class="text-muted-sm">by {{ c.createdBy }}</span>
        </div>
        <div class="card-foot">
          <NuxtLink :to="`/changelogs/${c.id}`" class="btn btn-ghost btn-sm">
            Edit &rarr;
          </NuxtLink>
          <button
            class="btn btn-ghost btn-sm action-btn"
            title="Delete changelog"
            @click="confirmDelete(c)"
          >
            <IconsTrash size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New Changelog</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="changelogApp">App</label>
              <select id="changelogApp" v-model="createForm.appId">
                <option v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="changelogTitle">Title</label>
              <input
                id="changelogTitle"
                v-model="createForm.title"
                type="text"
                placeholder="e.g. API Gateway v2.4.1"
                required
                :class="{ 'input-error': createTitleError }"
                aria-describedby="changelogTitleError"
                @input="createTitleError = false"
              />
              <span id="changelogTitleError" class="error-msg" :class="{ show: createTitleError }">
                Title is required
              </span>
            </div>
            <div class="form-group">
              <label for="changelogContent">
                Content <span class="opt">(optional)</span>
              </label>
              <textarea
                id="changelogContent"
                v-model="createForm.content"
                placeholder="Enter markdown changelog content…"
                rows="6"
              />
            </div>
            <div class="form-group">
              <label for="changelogStatus">Status</label>
              <select id="changelogStatus" v-model="createForm.status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create Changelog</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!changelogToDelete }" @click.self="changelogToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Changelog</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="changelogToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--muted);">
            Are you sure you want to delete <strong>{{ changelogToDelete?.title }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="changelogToDelete = null">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeletingItem" @click="doDelete">
            <span v-if="isDeletingItem">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.changelogs-page {
  /* Inherits global semantic tokens from :root */
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

h2 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
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
.action-btn {
  padding: 4px;
  border-radius: 6px;
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
.error-msg {
  display: none;
  color: oklch(50% 0.16 25);
  font-size: 12px;
  margin-top: 4px;
}
.error-msg.show {
  display: block;
}
.form-group input,
.form-group textarea,
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
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.form-group textarea {
  resize: vertical;
  min-height: 80px;
}
.input-error {
  border-color: oklch(55% 0.18 25) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent) !important;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.result-count {
  font-size: 13px;
  color: var(--muted);
  font-family: var(--font-mono);
}
.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 10%, transparent);
  min-width: 200px;
  padding: 6px 0;
  z-index: 50;
}
.dropdown-header {
  padding: 6px 16px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.dropdown-item:hover {
  background: var(--fg-soft);
}
.dropdown-item.active {
  color: var(--accent);
  font-weight: 500;
}
.check {
  width: 16px;
  text-align: center;
  font-size: 13px;
}
.check-placeholder {
  width: 16px;
  display: inline-block;
}
.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
.btn-ghost.active {
  color: var(--accent);
  background: var(--accent-soft);
}
.filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .modal-overlay,
  .modal,
  .btn,
  .search {
    transition: none !important;
  }
}
@media (max-width: 768px) {
  .search {
    width: 180px;
  }
}
</style>
