<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { AppItem } from "~/composables/useApps";

definePageMeta({
  auth: {
    required: true,
  },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Apps");
});

const {
  apps,
  stats,
  activities,
  isLoading,
  isCreating,
  search,
  fetchApps,
  fetchApp,
  fetchStats,
  fetchActivities,
  createApp,
  updateApp,
  deleteApp,
} = useApps();

const isDeleting = ref(false);

onMounted(() => {
  fetchApps();
  fetchStats();
  fetchActivities();
});

// Create modal
const showCreateModal = ref(false);
const createForm = reactive({
  name: "",
  description: "",
  owner: "",
  status: "active",
  repoUrl: "",
});
const createNameError = ref(false);

function openCreateModal() {
  showCreateModal.value = true;
  createNameError.value = false;
  createForm.name = "";
  createForm.description = "";
  createForm.owner = "";
  createForm.status = "active";
  createForm.repoUrl = "";
}

function closeCreateModal() {
  showCreateModal.value = false;
  createNameError.value = false;
}

async function submitCreate() {
  if (!createForm.name.trim()) {
    createNameError.value = true;
    return;
  }
  createNameError.value = false;
  await createApp({
    name: createForm.name.trim(),
    description: createForm.description,
    owner: createForm.owner,
    status: createForm.status,
    repoUrl: createForm.repoUrl,
  });
  closeCreateModal();
}

// Edit modal
const showEditModal = ref(false);
const editingApp = ref<AppItem | null>(null);
const editForm = reactive({
  name: "",
  description: "",
  owner: "",
  status: "active",
  repoUrl: "",
});
const editNameError = ref(false);
const isEditing = ref(false);

async function openEditModal(app: AppItem) {
  try {
    const fresh = await fetchApp(app.id);
    editingApp.value = fresh;
    editForm.name = fresh.name;
    editForm.description = fresh.description || "";
    editForm.owner = fresh.owner || "";
    editForm.status = fresh.status;
    editForm.repoUrl = fresh.repoUrl || "";
  } catch {
    // Fallback to stale data if fetch fails
    editingApp.value = app;
    editForm.name = app.name;
    editForm.description = app.description || "";
    editForm.owner = app.owner || "";
    editForm.status = app.status;
    editForm.repoUrl = app.repoUrl || "";
  }
  showEditModal.value = true;
  editNameError.value = false;
}

function closeEditModal() {
  showEditModal.value = false;
  editingApp.value = null;
  editNameError.value = false;
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    editNameError.value = true;
    return;
  }
  editNameError.value = false;
  if (!editingApp.value || isEditing.value) return;
  isEditing.value = true;
  try {
    await updateApp(editingApp.value.id, {
      name: editForm.name.trim(),
      description: editForm.description,
      owner: editForm.owner,
      status: editForm.status,
      repoUrl: editForm.repoUrl,
    });
    closeEditModal();
  } finally {
    isEditing.value = false;
  }
}

// Delete confirmation
const appToDelete = ref<AppItem | null>(null);

function confirmDelete(app: AppItem) {
  appToDelete.value = app;
}

async function doDelete() {
  if (!appToDelete.value || isDeleting.value) return;
  isDeleting.value = true;
  try {
    await deleteApp(appToDelete.value.id);
  } finally {
    appToDelete.value = null;
    isDeleting.value = false;
  }
}

function onSearch() {
  fetchApps();
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
  if (diff < 2419200) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2419200)} months ago`;
}

const statusClass: Record<string, string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  maintenance: "Maintenance",
};

const owners = ["Sarah Chen", "Mike Ross", "Jen Park", "Tom Lee"];
</script>

<template>
  <div class="apps-page">
    <!-- Topbar -->
    <header class="topbar">
      <h1>Apps</h1>
      <div style="display:flex;align-items:center;gap:16px;">
        <input
          v-model="search"
          class="search"
          placeholder="Search apps, versions, docs…"
          aria-label="Search apps, versions, and docs"
          @input="onSearch"
        />
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New App
        </button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-num">{{ stats?.activeApps ?? 0 }}</span>
        <span class="stat-label">Active Apps</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats?.totalVersions ?? 0 }}</span>
        <span class="stat-label">Total Versions</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats?.publishedDocs ?? 0 }}</span>
        <span class="stat-label">Published Docs</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats?.draftVersions ?? 0 }}</span>
        <span class="stat-label">Draft Versions</span>
      </div>
    </div>

    <!-- App cards -->
    <div class="row-between" style="margin-bottom:20px;">
      <h2>Your apps</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost">Filter</button>
        <button class="btn btn-ghost">Sort</button>
      </div>
    </div>

    <div v-if="isLoading" class="grid-4">
      <div v-for="n in 4" :key="n" class="card" style="height: 160px">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="apps.length === 0" class="empty-state">
      <p>No apps found.</p>
    </div>

    <div v-else class="grid-4">
      <div v-for="app in apps" :key="app.id" class="card">
        <div class="card-head">
          <div>
            <div class="card-title">{{ app.name }}</div>
            <div class="card-meta">Updated {{ timeAgo(app.updatedAt) }}</div>
          </div>
          <div class="card-actions">
            <span class="pill" :class="statusClass[app.status] || 'pill-blue'">
              {{ statusLabel[app.status] || app.status }}
            </span>
            <button
              class="btn btn-ghost btn-sm action-btn"
              title="Edit app"
              @click="openEditModal(app)"
            >
              <IconsPencil size="14" />
            </button>
            <button
              class="btn btn-ghost btn-sm action-btn"
              title="Delete app"
              @click="confirmDelete(app)"
            >
              <IconsTrash size="14" />
            </button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span v-if="app.latestVersion" class="num pill pill-blue">
            v{{ app.latestVersion.version }}
          </span>
          <span v-else class="num text-xs text-gray-400">No version</span>
          <span style="color:var(--muted);font-size:12px;">
            by {{ app.owner || "Unknown" }}
          </span>
        </div>
        <div class="card-foot">
          <NuxtLink :to="`/apps/${app.id}/versions`" class="btn btn-ghost btn-sm">
            Versions
          </NuxtLink>
          <NuxtLink :to="`/apps/${app.id}/docs`" class="btn btn-ghost btn-sm">
            Docs &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Recent activity -->
    <div style="margin-top:var(--gap-xl, 32px);">
      <div class="row-between" style="margin-bottom:16px;">
        <h2>Recent activity</h2>
        <button class="btn btn-ghost" @click="fetchActivities">
          Refresh
        </button>
      </div>
      <table class="ds-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>App</th>
            <th>Action</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in activities" :key="log.id">
            <td class="num">{{ formatDate(log.createdAt) }}</td>
            <td>{{ log.appName || "—" }}</td>
            <td>{{ log.action }}</td>
            <td>{{ log.actor }}</td>
          </tr>
          <tr v-if="activities.length === 0">
            <td colspan="4" class="text-center text-gray-400 py-4">
              No recent activity
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New App</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="appName">App Name</label>
              <input
                id="appName"
                v-model="createForm.name"
                type="text"
                placeholder="e.g. Payment Gateway"
                required
                :class="{ 'input-error': createNameError }"
                aria-describedby="appNameError"
                @input="createNameError = false"
              />
              <span id="appNameError" class="error-msg" :class="{ show: createNameError }">
                App name is required
              </span>
            </div>
            <div class="form-group">
              <label for="appDesc">
                Description <span class="opt">(optional)</span>
              </label>
              <textarea id="appDesc" v-model="createForm.description" placeholder="What does this app do?" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="appOwner">Owner</label>
                <select id="appOwner" v-model="createForm.owner">
                  <option value="">Select owner…</option>
                  <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="appStatus">Initial Status</label>
                <select id="appStatus" v-model="createForm.status">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="appRepo">
                Repository URL <span class="opt">(optional)</span>
              </label>
              <input id="appRepo" v-model="createForm.repoUrl" type="url" placeholder="https://github.com/org/repo" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create App</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal-overlay" :class="{ open: showEditModal }" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Edit App</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeEditModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitEdit">
          <div class="modal-body">
            <div class="form-group">
              <label for="editName">App Name</label>
              <input
                id="editName"
                v-model="editForm.name"
                type="text"
                required
                :class="{ 'input-error': editNameError }"
                aria-describedby="editNameError"
                @input="editNameError = false"
              />
              <span id="editNameError" class="error-msg" :class="{ show: editNameError }">
                App name is required
              </span>
            </div>
            <div class="form-group">
              <label for="editDesc">
                Description <span class="opt">(optional)</span>
              </label>
              <textarea id="editDesc" v-model="editForm.description" placeholder="What does this app do?" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="editOwner">Owner</label>
                <select id="editOwner" v-model="editForm.owner">
                  <option value="">Select owner…</option>
                  <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="editStatus">Status</label>
                <select id="editStatus" v-model="editForm.status">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="editRepo">
                Repository URL <span class="opt">(optional)</span>
              </label>
              <input id="editRepo" v-model="editForm.repoUrl" type="url" placeholder="https://github.com/org/repo" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeEditModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isEditing">
              <span v-if="isEditing">Saving…</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!appToDelete }" @click.self="appToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete App</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="appToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--muted);">
            Are you sure you want to delete <strong>{{ appToDelete?.name }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="appToDelete = null">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="doDelete">
            <span v-if="isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apps-page {
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

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) {
  .grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .grid-4 {
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
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.stats-bar {
  display: flex;
  gap: 24px;
  align-items: baseline;
  margin-bottom: 32px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.stat-num {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}
.stat-label {
  font-size: 14px;
  color: var(--muted);
}
@media (max-width: 720px) {
  .stats-bar {
    flex-wrap: wrap;
    gap: 16px;
  }
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ds-table th,
.ds-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.ds-table th {
  color: var(--muted);
  font-weight: 500;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ds-table tbody tr:hover {
  background: var(--fg-soft);
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
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
