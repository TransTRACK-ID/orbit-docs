<script setup lang="ts">
import { usePageStore } from "~/store/page";

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
  fetchStats,
  fetchActivities,
  createApp,
  deleteApp,
} = useApps();

onMounted(() => {
  fetchApps();
  fetchStats();
  fetchActivities();
});

const showModal = ref(false);
const form = reactive({
  name: "",
  description: "",
  owner: "",
  status: "active",
  repoUrl: "",
});
const nameError = ref(false);

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

function openModal() {
  showModal.value = true;
  nameError.value = false;
  form.name = "";
  form.description = "";
  form.owner = "";
  form.status = "active";
  form.repoUrl = "";
}

function closeModal() {
  showModal.value = false;
  nameError.value = false;
}

async function submitForm() {
  if (!form.name.trim()) {
    nameError.value = true;
    return;
  }
  nameError.value = false;
  await createApp({
    name: form.name.trim(),
    description: form.description,
    owner: form.owner,
    status: form.status,
    repoUrl: form.repoUrl,
  });
  closeModal();
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

const owners = ["Sarah Chen", "Mike Ross", "Jen Park", "Tom Lee"];
</script>

<template>
  <div class="apps-page">
    <!-- Stats bar -->
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

    <!-- Header row -->
    <div class="row-between" style="margin-bottom: 20px">
      <h2>Your apps</h2>
      <div class="flex gap-2">
        <div class="relative">
          <input
            v-model="search"
            class="search"
            placeholder="Search apps…"
            aria-label="Search apps"
            @input="onSearch"
          />
        </div>
        <button type="button" class="btn btn-primary" @click="openModal">
          + New App
        </button>
      </div>
    </div>

    <!-- App cards -->
    <div v-if="isLoading" class="grid-4">
      <div
        v-for="n in 4"
        :key="n"
        class="card"
        style="height: 160px"
      >
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <div v-else-if="apps.length === 0" class="text-center py-12">
      <p class="text-gray-500">No apps found.</p>
    </div>

    <div v-else class="grid-4">
      <div
        v-for="app in apps"
        :key="app.id"
        class="card"
      >
        <div class="card-head">
          <div>
            <div class="card-title">{{ app.name }}</div>
            <div class="card-meta">
              Updated {{ timeAgo(app.updatedAt) }}
            </div>
          </div>
          <span
            class="pill"
            :class="statusClass[app.status] || 'pill-blue'"
          >
            {{ statusLabel[app.status] || app.status }}
          </span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span
            v-if="app.latestVersion"
            class="num pill pill-blue"
          >
            v{{ app.latestVersion.version }}
          </span>
          <span v-else class="num text-xs text-gray-400">No version</span>
          <span class="text-xs text-gray-500">by {{ app.owner || "Unknown" }}</span>
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
    <div class="mt-8">
      <div class="row-between mb-4">
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
            <td>{{ log.user }}</td>
          </tr>
          <tr v-if="activities.length === 0">
            <td colspan="4" class="text-center text-gray-400 py-4">
              No recent activity
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- New App Modal -->
    <div class="modal-overlay" :class="{ open: showModal }" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New App</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close modal"
            @click="closeModal"
          >
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitForm">
          <div class="modal-body">
            <div class="form-group">
              <label for="appName">App Name</label>
              <input
                id="appName"
                v-model="form.name"
                type="text"
                placeholder="e.g. Payment Gateway"
                required
                :class="{ 'input-error': nameError }"
                aria-describedby="appNameError"
                @input="nameError = false"
              />
              <span
                id="appNameError"
                class="error-msg"
                :class="{ show: nameError }"
              >
                App name is required
              </span>
            </div>
            <div class="form-group">
              <label for="appDesc">
                Description <span class="opt">(optional)</span>
              </label>
              <textarea
                id="appDesc"
                v-model="form.description"
                placeholder="What does this app do?"
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="appOwner">Owner</label>
                <select id="appOwner" v-model="form.owner">
                  <option value="">Select owner…</option>
                  <option v-for="o in owners" :key="o" :value="o">
                    {{ o }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label for="appStatus">Initial Status</label>
                <select id="appStatus" v-model="form.status">
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
              <input
                id="appRepo"
                v-model="form.repoUrl"
                type="url"
                placeholder="https://github.com/org/repo"
              />
            </div>
          </div>
          <div class="modal-foot">
            <button
              type="button"
              class="btn btn-secondary"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isCreating"
            >
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create App</span>
            </button>
          </div>
        </form>
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
</style>
