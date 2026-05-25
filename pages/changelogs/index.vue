<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: { required: true },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Changelogs");
});

const { apps, fetchApps } = useApps();
const { changelogs, isLoading, isCreating, fetchChangelogs, createChangelog, deleteChangelog } = useChangelogs();

const route = useRoute();
const router = useRouter();

// App selector
const selectedAppId = ref<string>("");

onMounted(async () => {
  await fetchApps();
  const appQuery = route.query.app as string;
  if (appQuery && apps.value.find((a) => a.id === appQuery)) {
    selectedAppId.value = appQuery;
  }
  await fetchChangelogs(selectedAppId.value ? { app: selectedAppId.value } : undefined);
});

watch(selectedAppId, async (id) => {
  await fetchChangelogs(id ? { app: id } : undefined);
});

const selectedApp = computed(() => apps.value.find((a) => a.id === selectedAppId.value));

// Search
const searchQuery = ref("");

const filteredChangelogs = computed(() => {
  let result = [...changelogs.value];
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (c) =>
        (c.appName && c.appName.toLowerCase().includes(q)) ||
        (c.version && c.version.toLowerCase().includes(q)) ||
        (c.author && c.author.toLowerCase().includes(q)) ||
        (c.content && c.content.toLowerCase().includes(q))
    );
  }
  return result;
});

// New changelog modal
const showNewModal = ref(false);
const newVersionId = ref("");
const newChangelogError = ref(false);

function openNewModal() {
  showNewModal.value = true;
  newVersionId.value = "";
  newChangelogError.value = false;
}

function closeNewModal() {
  showNewModal.value = false;
}

async function submitNewChangelog() {
  if (!selectedAppId.value) {
    newChangelogError.value = true;
    return;
  }
  newChangelogError.value = false;
  const payload: any = { appId: selectedAppId.value };
  if (newVersionId.value) payload.versionId = newVersionId.value;
  const data = await createChangelog(payload);
  closeNewModal();
  await navigateTo(`/changelogs/${data.id}`);
}

// Delete confirmation
const changelogToDelete = ref<string | null>(null);

function confirmDelete(id: string) {
  changelogToDelete.value = id;
}

async function doDelete() {
  if (!changelogToDelete.value) return;
  await deleteChangelog(changelogToDelete.value);
  changelogToDelete.value = null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeNewModal();
    changelogToDelete.value = null;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="changelogs-page">
    <!-- Topbar -->
    <div class="topbar" style="margin-bottom: 16px;">
      <h1>Changelogs</h1>
      <div class="flex-gap-md">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search changelogs…"
          aria-label="Search changelogs"
        />
        <select v-model="selectedAppId" class="select" aria-label="Filter by app">
          <option value="">All apps</option>
          <option v-for="app in apps" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>
        <button type="button" class="btn btn-primary" @click="openNewModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Changelog
        </button>
      </div>
    </div>

    <!-- App info -->
    <div v-if="selectedApp" class="row-between" style="margin-bottom: 16px;">
      <div>
        <h2 class="section-title">
          {{ selectedApp.name }} · {{ filteredChangelogs.length }} changelog{{ filteredChangelogs.length === 1 ? "" : "s" }}
        </h2>
      </div>
    </div>

    <!-- Changelogs table -->
    <div class="card table-card">
      <table class="ds-table">
        <thead>
          <tr>
            <th>App</th>
            <th>Version</th>
            <th>Status</th>
            <th>Author</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filteredChangelogs"
            :key="c.id"
            class="cursor-pointer"
            @click="navigateTo(`/changelogs/${c.id}`)"
          >
            <td>{{ c.appName }}</td>
            <td class="num">{{ c.version ? `v${c.version}` : "—" }}</td>
            <td>
              <span class="pill" :class="statusClass[c.status] || 'pill-blue'">
                {{ statusLabel[c.status] || c.status }}
              </span>
            </td>
            <td>{{ c.author || "—" }}</td>
            <td class="num">{{ formatDate(c.updatedAt) }}</td>
            <td @click.stop>
              <div class="flex-gap-sm">
                <button class="btn btn-ghost btn-sm" title="Edit changelog" @click="navigateTo(`/changelogs/${c.id}`)">
                  <IconsPencil size="14" />
                </button>
                <button class="btn btn-ghost btn-sm" title="Delete changelog" @click="confirmDelete(c.id)">
                  <IconsTrash size="14" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredChangelogs.length === 0 && !isLoading">
            <td colspan="6" class="empty-cell">No changelogs found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- New Changelog Modal -->
    <div class="modal-overlay" :class="{ open: showNewModal }" @click.self="closeNewModal">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>New Changelog</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeNewModal">✕</button>
        </div>
        <form novalidate @submit.prevent="submitNewChangelog">
          <div class="modal-body">
            <div class="form-group">
              <label for="changelogApp">App</label>
              <select id="changelogApp" v-model="selectedAppId" :class="{ 'input-error': newChangelogError }">
                <option v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </option>
              </select>
              <span class="error-msg" :class="{ show: newChangelogError }">
                Please select an app
              </span>
            </div>
            <div class="form-group">
              <label for="changelogVersion">Version <span class="opt">(optional)</span></label>
              <select id="changelogVersion" v-model="newVersionId">
                <option value="">No version</option>
                <option
                  v-for="v in selectedApp?.latestVersion ? [selectedApp.latestVersion] : []"
                  :key="v.id"
                  :value="v.id"
                >
                  v{{ v.version }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-footer">
            <button type="button" class="btn btn-secondary" @click="closeNewModal">Cancel</button>
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
      <div class="modal-panel" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Delete Changelog</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="changelogToDelete = null">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to delete this changelog? This action cannot be undone.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="changelogToDelete = null">Cancel</button>
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
.changelogs-page {
  max-width: 960px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.section-title {
  font-size: 20px;
  font-weight: 600;
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

.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}
.select:focus {
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
  border-color: var(--accent);
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

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
}
.table-card {
  padding: 0;
  overflow: hidden;
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ds-table th,
.ds-table td {
  padding: 14px 16px;
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
.ds-table tbody tr.cursor-pointer {
  cursor: pointer;
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
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
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

.empty-cell {
  text-align: center;
  color: var(--muted);
  padding: 32px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.modal-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  transform: translateY(12px) scale(0.98);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open .modal-panel {
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
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-close:hover {
  color: var(--fg);
  border-color: var(--fg);
}
.modal-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
.form-group select,
.form-group input[type="text"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.form-group select:focus,
.form-group input:focus {
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
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-panel,
  .btn,
  .search,
  .select {
    transition: none !important;
  }
}
@media (max-width: 768px) {
  .search {
    width: 180px;
  }
  .topbar {
    flex-wrap: wrap;
  }
}
</style>
