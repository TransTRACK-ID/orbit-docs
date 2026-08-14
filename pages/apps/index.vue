<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { AppItem } from "~/composables/useApps";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { can, canAny } = usePermissions();

const canCreateApp = computed(() => can("apps:write"));
const canEditApp = computed(() => can("apps:write"));
const canDeleteApp = computed(() => can("apps:delete"));
const canGenerateDocs = computed(() => can("doc_generation:run"));
const canOpenAppMenu = computed(() =>
  canAny("apps:write", "apps:delete", "doc_generation:run")
);

onBeforeMount(() => {
  $page.setTitle("Apps");
});

const {
  apps,
  stats,
  activities,
  isLoading,
  isCreating,
  fetchApps,
  fetchApp,
  fetchStats,
  fetchActivities,
  createApp,
  updateApp,
  deleteApp,
} = useApps();

const isDeleting = ref(false);
const isRefreshingActivities = ref(false);

const searchQuery = ref("");
const statusFilter = ref("");
const sortKey = ref("updatedAt-desc");
const openAppMenu = ref<string | null>(null);

const statusFilterOptions = [
  { id: "", label: "Semua status" },
  { id: "active", label: "Aktif" },
  { id: "draft", label: "Draft" },
  { id: "maintenance", label: "Maintenance" },
];

const sortOptions = [
  { id: "updatedAt-desc", label: "Terbaru diperbarui" },
  { id: "updatedAt-asc", label: "Terlama diperbarui" },
  { id: "name-asc", label: "Nama A–Z" },
  { id: "name-desc", label: "Nama Z–A" },
  { id: "status-asc", label: "Status" },
];

const sortBy = ref<"updatedAt" | "name" | "status">("updatedAt");
const sortOrder = ref<"asc" | "desc">("desc");

watch(sortKey, (key) => {
  const [field, order] = key.split("-") as ["updatedAt" | "name" | "status", "asc" | "desc"];
  sortBy.value = field;
  sortOrder.value = order;
});

function toggleAppMenu(appId: string) {
  openAppMenu.value = openAppMenu.value === appId ? null : appId;
}

onMounted(() => {
  fetchApps();
  fetchStats();
  fetchActivities();
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});

const pageSubtitle = computed(() => {
  const active = stats.value?.activeApps ?? apps.value.filter((a) => a.status === "active").length;
  return `${active} aplikasi aktif: pusat dokumentasi dan versi lintas produk Transtrack.`;
});

const hasActiveFilters = computed(
  () => !!searchQuery.value.trim() || !!statusFilter.value
);

const filteredApps = computed(() => {
  let result = [...apps.value];

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.owner && a.owner.toLowerCase().includes(q)) ||
        (a.latestVersion?.version &&
          a.latestVersion.version.toLowerCase().includes(q))
    );
  }

  if (statusFilter.value) {
    result = result.filter((a) => a.status === statusFilter.value);
  }

  result.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy.value === "updatedAt") {
      const dateA = a.latestVersion?.releaseDate || a.latestVersion?.createdAt || a.updatedAt || 0;
      const dateB = b.latestVersion?.releaseDate || b.latestVersion?.createdAt || b.updatedAt || 0;
      cmp = new Date(dateA).getTime() - new Date(dateB).getTime();
    } else if (sortBy.value === "status") {
      const order = { active: 0, maintenance: 1, draft: 2 };
      cmp = (order[a.status] ?? 99) - (order[b.status] ?? 99);
    }
    return sortOrder.value === "asc" ? cmp : -cmp;
  });

  return result;
});

const activityContributors = computed(() => {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const log of activities.value) {
    const actor = log.actor?.trim();
    if (actor && !seen.has(actor)) {
      seen.add(actor);
      list.push(actor);
    }
  }
  return list.slice(0, 7);
});

const activitySubtitle = computed(() => {
  const count = activityContributors.value.length;
  if (count === 0) return "Aktivitas seluruh tim";
  return `Aktivitas seluruh tim (${count} kontributor minggu ini)`;
});

function clearFilters() {
  searchQuery.value = "";
  statusFilter.value = "";
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest(".actions-menu")) openAppMenu.value = null;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    openAppMenu.value = null;
    if (showCreateModal.value) closeCreateModal();
    if (showEditModal.value) closeEditModal();
    if (appToDelete.value) appToDelete.value = null;
  }
}

async function refreshActivities() {
  if (isRefreshingActivities.value) return;
  isRefreshingActivities.value = true;
  try {
    await fetchActivities();
  } finally {
    isRefreshingActivities.value = false;
  }
}

// Create modal
const showCreateModal = ref(false);
const createForm = reactive({
  name: "",
  description: "",
  owner: "",
  status: "active",
});
const createNameError = ref(false);

function openCreateModal() {
  showCreateModal.value = true;
  createNameError.value = false;
  createForm.name = "";
  createForm.description = "";
  createForm.owner = "";
  createForm.status = "active";
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
  } catch {
    editingApp.value = app;
    editForm.name = app.name;
    editForm.description = app.description || "";
    editForm.owner = app.owner || "";
    editForm.status = app.status;
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
    });
    closeEditModal();
  } finally {
    isEditing.value = false;
  }
}

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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
}

function versionAuthor(app: AppItem): string | null {
  return app.latestVersion?.createdBy || app.owner || null;
}

function timeAgoId(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} menit lalu`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} jam lalu`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} hari lalu`;
  }
  if (diff < 2419200) {
    const weeks = Math.floor(diff / 604800);
    return `${weeks} minggu lalu`;
  }
  const months = Math.floor(diff / 2419200);
  return `${months} bulan lalu`;
}

function appUpdatedLabel(app: AppItem) {
  const date =
    app.latestVersion?.releaseDate ||
    app.latestVersion?.createdAt ||
    app.updatedAt;
  const ago = timeAgoId(date);
  return ago ? `Diperbarui ${ago}` : "Belum diperbarui";
}

function appInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const APP_ICON_HUES = [25, 145, 255, 85, 300, 45, 200, 15];

function appIconStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = APP_ICON_HUES[Math.abs(hash) % APP_ICON_HUES.length];
  return {
    background: `color-mix(in oklch, oklch(72% 0.12 ${hue}) 18%, var(--surface))`,
    color: `oklch(42% 0.12 ${hue})`,
  };
}

const statusClass: Record<string, string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

const statusLabel: Record<string, string> = {
  active: "AKTIF",
  draft: "DRAFT",
  maintenance: "MAINTENANCE",
};
</script>

<template>
  <div class="apps-page">
    <header class="page-masthead">
      <div class="page-masthead__copy">
        <h1>Apps</h1>
        <p class="page-subtitle">{{ pageSubtitle }}</p>
      </div>
      <div class="page-masthead__actions">
        <button v-if="canCreateApp" type="button" class="btn btn-primary" @click="openCreateModal">
          + App Baru
        </button>
      </div>
    </header>

    <div class="filter-strip">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Cari apps, versi, docs..."
          aria-label="Cari apps, versi, dan docs"
        />
      </div>
      <GeneralSearchableDropdown
        v-model="statusFilter"
        :options="statusFilterOptions"
        placeholder="Semua status"
        search-placeholder="Filter status..."
      />
      <GeneralSearchableDropdown
        v-model="sortKey"
        :options="sortOptions"
        placeholder="Terbaru diperbarui"
        search-placeholder="Urutkan..."
      />
    </div>

    <div class="stats-bar" aria-label="Ringkasan aplikasi">
      <div class="stat">
        <span class="stat-num num">{{ stats?.activeApps ?? 0 }}</span>
        <span class="stat-label">Aplikasi aktif</span>
      </div>
      <div class="stat">
        <span class="stat-num num">{{ stats?.totalVersions ?? 0 }}</span>
        <span class="stat-label">Total versi</span>
      </div>
      <div class="stat">
        <span class="stat-num num">{{ stats?.publishedDocs ?? 0 }}</span>
        <span class="stat-label">Docs terbit</span>
      </div>
      <div class="stat">
        <span class="stat-num num">{{ stats?.draftVersions ?? 0 }}</span>
        <span class="stat-label">Versi draft</span>
      </div>
    </div>

    <div class="section-head">
      <div class="section-head__copy">
        <h2>Aplikasi Anda</h2>
        <span v-if="hasActiveFilters" class="result-count">
          {{ filteredApps.length }} hasil
        </span>
      </div>
    </div>

    <GeneralSkeletonAppGrid v-if="isLoading" />

    <div v-else-if="filteredApps.length === 0" class="empty-state">
      <p>Tidak ada aplikasi yang cocok.</p>
      <button v-if="hasActiveFilters" type="button" class="btn btn-ghost" @click="clearFilters">
        Hapus filter
      </button>
      <button
        v-else-if="canCreateApp"
        type="button"
        class="btn btn-primary"
        style="margin-top: 12px;"
        @click="openCreateModal"
      >
        Buat aplikasi pertama
      </button>
    </div>

    <div v-else class="app-grid">
      <article v-for="app in filteredApps" :key="app.id" class="app-card">
        <div class="app-card__top">
          <div class="app-card__identity">
            <div class="app-icon" :style="appIconStyle(app.name)" aria-hidden="true">
              {{ appInitials(app.name) }}
            </div>
            <div class="app-card__titles">
              <h3 class="app-card__name">{{ app.name }}</h3>
              <p class="app-card__meta">{{ appUpdatedLabel(app) }}</p>
            </div>
          </div>
          <span class="pill" :class="statusClass[app.status] || 'pill-blue'">
            {{ statusLabel[app.status] || app.status.toUpperCase() }}
          </span>
        </div>

        <div v-if="app.latestVersion" class="app-version-strip">
          <span class="num">v{{ app.latestVersion.version }}</span>
          <span v-if="versionAuthor(app)" class="app-version-strip__by">
            oleh {{ versionAuthor(app) }}
          </span>
        </div>

        <footer class="app-card__foot">
          <div class="cell-actions">
            <div class="app-card__links">
              <NuxtLink :to="`/docs?app=${app.id}`" class="btn btn-ghost btn-sm row-action">
                Docs &rarr;
              </NuxtLink>
              <NuxtLink :to="`/apps/${app.id}/versions`" class="btn btn-ghost btn-sm row-action">
                Versi &rarr;
              </NuxtLink>
            </div>
            <div v-if="canOpenAppMenu" class="action-dropdown-wrap actions-menu">
              <button
                type="button"
                class="btn btn-ghost btn-sm row-action row-action--icon"
                aria-label="Aksi lainnya"
                aria-haspopup="menu"
                :aria-expanded="openAppMenu === app.id"
                @click.stop="toggleAppMenu(app.id)"
              >
                <IconsDotsVertical size="14" />
              </button>
              <div
                v-if="openAppMenu === app.id"
                class="dropdown-menu actions-dropdown"
                role="menu"
                @click.stop
              >
                <NuxtLink
                  :to="`/releases?app=${app.name}`"
                  class="dropdown-item"
                  role="menuitem"
                  @click="openAppMenu = null"
                >
                  Releases
                </NuxtLink>
                <NuxtLink
                  v-if="canGenerateDocs"
                  :to="`/docs/generate/${app.id}`"
                  class="dropdown-item"
                  role="menuitem"
                  @click="openAppMenu = null"
                >
                  Generate Docs
                </NuxtLink>
                <button
                  v-if="canEditApp"
                  type="button"
                  class="dropdown-item"
                  role="menuitem"
                  @click="openEditModal(app); openAppMenu = null"
                >
                  <IconsPencil size="14" />
                  Edit
                </button>
                <button
                  v-if="canDeleteApp"
                  type="button"
                  class="dropdown-item dropdown-item--danger"
                  role="menuitem"
                  @click="confirmDelete(app); openAppMenu = null"
                >
                  <IconsTrash size="14" />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </footer>
      </article>
    </div>

    <section class="activity-section" aria-labelledby="activity-heading">
      <div class="activity-head">
        <div class="activity-head__copy">
          <h2 id="activity-heading">Aktivitas terbaru</h2>
          <p class="activity-subtitle">{{ activitySubtitle }}</p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="isRefreshingActivities"
          @click="refreshActivities"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            :class="{ 'is-spinning': isRefreshingActivities }"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          Segarkan
        </button>
      </div>

      <div v-if="activityContributors.length" class="contributor-row" aria-label="Kontributor aktif">
        <GeneralAvatar
          v-for="actor in activityContributors"
          :key="actor"
          :name="actor"
          :size="28"
        />
      </div>

      <div class="activity-panel">
        <GeneralDataTable :scrollable="true">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Aplikasi</th>
              <th>Aksi</th>
              <th>Pengguna</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in activities" :key="log.id">
              <td class="col-num col-muted">{{ formatDate(log.createdAt) }}</td>
              <td>{{ log.appName || "—" }}</td>
              <td>{{ log.action }}</td>
              <td>
                <span class="actor-cell">
                  <GeneralAvatar :name="log.actor" :size="24" />
                  <span>{{ log.actor }}</span>
                </span>
              </td>
            </tr>
            <tr v-if="activities.length === 0">
              <td colspan="4" class="empty-row">Belum ada aktivitas</td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </div>
    </section>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Buat App Baru</h2>
          <button type="button" class="modal-close" aria-label="Tutup" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="appName">Nama App</label>
              <input
                id="appName"
                v-model="createForm.name"
                type="text"
                placeholder="mis. Payment Gateway"
                required
                :class="{ 'input-error': createNameError }"
                aria-describedby="appNameError"
                @input="createNameError = false"
              />
              <span id="appNameError" class="error-msg" :class="{ show: createNameError }">
                Nama app wajib diisi
              </span>
            </div>
            <div class="form-group">
              <label for="appDesc">
                Deskripsi <span class="opt">(opsional)</span>
              </label>
              <textarea id="appDesc" v-model="createForm.description" placeholder="Apa fungsi app ini?" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="appOwner">Owner</label>
                <AppOwnerSelect id="appOwner" v-model="createForm.owner" />
              </div>
              <div class="form-group">
                <label for="appStatus">Status awal</label>
                <select id="appStatus" v-model="createForm.status">
                  <option value="active">Aktif</option>
                  <option value="draft">Draft</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Batal
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Membuat…</span>
              <span v-else>Buat App</span>
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
          <button type="button" class="modal-close" aria-label="Tutup" @click="closeEditModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitEdit">
          <div class="modal-body">
            <div class="form-group">
              <label for="editName">Nama App</label>
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
                Nama app wajib diisi
              </span>
            </div>
            <div class="form-group">
              <label for="editDesc">
                Deskripsi <span class="opt">(opsional)</span>
              </label>
              <textarea id="editDesc" v-model="editForm.description" placeholder="Apa fungsi app ini?" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="editOwner">Owner</label>
                <AppOwnerSelect id="editOwner" v-model="editForm.owner" />
              </div>
              <div class="form-group">
                <label for="editStatus">Status</label>
                <select id="editStatus" v-model="editForm.status">
                  <option value="active">Aktif</option>
                  <option value="draft">Draft</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeEditModal">
              Batal
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isEditing">
              <span v-if="isEditing">Menyimpan…</span>
              <span v-else>Simpan</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!appToDelete }" @click.self="appToDelete = null">
      <div class="modal modal--narrow">
        <div class="modal-header">
          <h2>Hapus App</h2>
          <button type="button" class="modal-close" aria-label="Tutup" @click="appToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-text">
            Yakin ingin menghapus <strong>{{ appToDelete?.name }}</strong>? Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="appToDelete = null">
            Batal
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="doDelete">
            <span v-if="isDeleting">Menghapus…</span>
            <span v-else>Hapus</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apps-page {
  /* Inherits global semantic tokens from :root */
}

.page-masthead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-masthead__copy {
  min-width: 0;
}

.page-masthead h1 {
  margin: 0 0 4px;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.page-subtitle {
  margin: 0;
  max-width: 52ch;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.page-masthead__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.search-wrap {
  position: relative;
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 360px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}

.search {
  width: 100%;
  padding: 8px 12px 8px 36px;
}

.stats-bar {
  display: flex;
  gap: 24px;
  align-items: baseline;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.stat-label {
  font-size: 14px;
  color: var(--muted);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-head__copy {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.section-head h2,
.activity-head h2 {
  margin: 0;
  font-weight: 600;
  font-size: 18px;
  color: var(--fg);
}

.result-count {
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 36px;
}

.app-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 168px;
  transition: border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.app-card:hover {
  border-color: color-mix(in oklch, var(--fg) 18%, var(--border));
}

.app-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.app-card__identity {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.app-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: var(--font-mono);
}

.app-card__titles {
  min-width: 0;
}

.app-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-card__meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.app-version-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: color-mix(in oklch, oklch(60% 0.16 255) 10%, var(--surface));
  font-size: 12px;
  color: oklch(45% 0.12 255);
}

.app-version-strip__by {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-card__foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.cell-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.app-card__links {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.row-action {
  min-height: 32px;
  padding: 6px 10px;
  color: var(--muted);
  text-decoration: none;
}

.row-action:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.row-action--icon {
  width: 32px;
  padding: 0;
  justify-content: center;
}

.action-dropdown-wrap {
  position: relative;
  flex-shrink: 0;
}

.actions-menu {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 168px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 10%, transparent);
  z-index: 20;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius);
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--fg);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: var(--fg-soft);
}

.dropdown-item--danger {
  color: oklch(50% 0.16 25);
}

.dropdown-item--danger:hover {
  background: color-mix(in oklch, oklch(55% 0.16 25) 10%, transparent);
}

.activity-section {
  margin-top: 8px;
}

.activity-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.activity-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.contributor-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
}

.activity-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.actor-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.col-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.col-muted {
  color: var(--muted);
}

.empty-row {
  text-align: center;
  padding: 28px 16px !important;
  color: var(--muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  flex-shrink: 0;
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

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
  margin-bottom: 32px;
}

.is-spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  transition: opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1);
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
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.modal--narrow {
  width: 400px;
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

.modal-text {
  margin: 0;
  color: var(--muted);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
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

@media (max-width: 1100px) {
  .app-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .app-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page-masthead {
    flex-direction: column;
    align-items: stretch;
  }

  .page-masthead__actions {
    width: 100%;
  }

  .page-masthead__actions .btn-primary {
    width: 100%;
  }

  .filter-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrap {
    max-width: none;
    flex-basis: auto;
  }

  .section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .app-grid {
    grid-template-columns: 1fr;
  }

  .stats-bar {
    gap: 16px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-card,
  .modal-overlay,
  .modal,
  .is-spinning {
    transition: none !important;
    animation: none !important;
  }
}
</style>
