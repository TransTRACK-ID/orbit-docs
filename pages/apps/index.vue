<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { AppItem } from "~/composables/useApps";
import GeneralLogoUploadField from "~/components/general/LogoUploadField.vue";
import type { AppDrawerTab } from "~/components/app/DetailDrawer.vue";
import { timeAgo } from "~/utils/ui";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { can } = usePermissions();

const canCreateApp = computed(() => can("apps:write"));
const canEditApp = computed(() => can("apps:write"));
const canDeleteApp = computed(() => can("apps:delete"));
const canGenerateDocs = computed(() => can("doc_generation:run"));

onBeforeMount(() => {
  $page.setTitle("Apps");
});

const {
  apps,
  stats,
  activities,
  isLoading,
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

const selectedAppIds = ref<string[]>([]);
const appFilterOptions = computed(() =>
  apps.value.map((a) => ({ id: a.id, label: a.name }))
);

// Drop selections for apps that no longer exist (e.g. just deleted).
watch(apps, (list) => {
  const known = new Set(list.map((a) => a.id));
  if (selectedAppIds.value.some((id) => !known.has(id))) {
    selectedAppIds.value = selectedAppIds.value.filter((id) => known.has(id));
  }
});

const statusFilterOptions = [
  { id: "", label: "All Status" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "maintenance", label: "Maintenance" },
];

const sortOptions = [
  { id: "updatedAt-desc", label: "Recently Updated" },
  { id: "updatedAt-asc", label: "Least Recently Updated" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
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

const route = useRoute();
const router = useRouter();

async function openModalFromQuery() {
  const editId = route.query.edit as string | undefined;
  const deleteId = route.query.delete as string | undefined;
  if (!editId && !deleteId) return;
  const { edit: _edit, delete: _delete, ...rest } = route.query;
  router.replace({ query: rest });
  const target = apps.value.find((a) => a.id === (editId || deleteId));
  if (!target) return;
  if (editId && canEditApp.value) await openEditModal(target);
  else if (deleteId && canDeleteApp.value) confirmDelete(target);
}

onMounted(() => {
  fetchApps().then(openModalFromQuery);
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
  return `${active} active ${active === 1 ? "app" : "apps"}. Docs and versions for every Transtrack product.`;
});

const headerStats = computed(() => [
  { label: "Active apps", value: stats.value?.activeApps ?? 0 },
  { label: "Total versions", value: stats.value?.totalVersions ?? 0 },
  { label: "Published docs", value: stats.value?.publishedDocs ?? 0 },
  { label: "Draft versions", value: stats.value?.draftVersions ?? 0 },
]);

const hasActiveFilters = computed(
  () => !!searchQuery.value.trim() || !!statusFilter.value || selectedAppIds.value.length > 0
);

const filteredApps = computed(() => {
  let result = [...apps.value];

  if (selectedAppIds.value.length > 0) {
    const ids = new Set(selectedAppIds.value);
    result = result.filter((a) => ids.has(a.id));
  }

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
  if (count === 0) return "Activity across the team";
  return `Activity across the team (${count} ${count === 1 ? "contributor" : "contributors"} this week)`;
});

function clearFilters() {
  searchQuery.value = "";
  statusFilter.value = "";
  selectedAppIds.value = [];
}

// App detail drawer, deep-linkable via ?app=<id>&tab=<docs|releases|sites>
const DRAWER_TABS: AppDrawerTab[] = ["docs", "releases", "sites"];

const drawerAppId = computed(() => {
  const id = route.query.app;
  return typeof id === "string" && id ? id : null;
});

const drawerTab = computed<AppDrawerTab>(() => {
  const tab = route.query.tab;
  // "versions" was a tab on the old detail page; it is now merged into Releases.
  if (tab === "versions") return "releases";
  return DRAWER_TABS.includes(tab as AppDrawerTab) ? (tab as AppDrawerTab) : "docs";
});

const drawerApp = computed(
  () => (drawerAppId.value ? apps.value.find((a) => a.id === drawerAppId.value) ?? null : null)
);

function drawerLink(app: AppItem) {
  const { app: _app, tab: _tab, ...rest } = route.query;
  return { query: { ...rest, app: app.id } };
}

function closeDrawer() {
  const { app: _app, tab: _tab, ...rest } = route.query;
  router.replace({ query: rest });
}

function setDrawerTab(tab: AppDrawerTab) {
  router.replace({ query: { ...route.query, tab } });
}

// Unknown or deleted app id: drop the drawer once the list has loaded.
watch([isLoading, apps, drawerAppId], () => {
  if (!isLoading.value && drawerAppId.value && !drawerApp.value) closeDrawer();
});

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest(".actions-menu")) openAppMenu.value = null;
}

function onKeydown(e: KeyboardEvent) {
  // A dropdown that handled Esc itself calls preventDefault; don't also close what's behind it.
  if (e.key !== "Escape" || e.defaultPrevented) return;
  openAppMenu.value = null;
  if (showFormModal.value) closeFormModal();
  else if (appToDelete.value) appToDelete.value = null;
  else if (drawerAppId.value) closeDrawer();
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

// Create / edit modal (shared form)
type FormMode = "create" | "edit";

const formMode = ref<FormMode | null>(null);
const showFormModal = computed(() => formMode.value !== null);
const editingApp = ref<AppItem | null>(null);
const isSubmitting = ref(false);

const appForm = reactive({
  name: "",
  description: "",
  owner: "",
  status: "",
  logoUrl: "",
});
const formErrors = reactive({ name: false, owner: false, status: false });

const formStatusOptions = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "maintenance", label: "Maintenance" },
];

function resetFormErrors() {
  formErrors.name = false;
  formErrors.owner = false;
  formErrors.status = false;
}

function fillForm(source: Pick<AppItem, "name" | "description" | "owner" | "status" | "logoUrl"> | null) {
  appForm.name = source?.name ?? "";
  appForm.description = source?.description ?? "";
  appForm.owner = source?.owner ?? "";
  appForm.status = source?.status ?? "";
  appForm.logoUrl = source?.logoUrl ?? "";
  resetFormErrors();
}

function openCreateModal() {
  editingApp.value = null;
  fillForm(null);
  formMode.value = "create";
}

async function openEditModal(app: AppItem) {
  let target = app;
  try {
    target = await fetchApp(app.id);
  } catch {
    // fall back to the list copy
  }
  editingApp.value = target;
  fillForm(target);
  formMode.value = "edit";
}

function closeFormModal() {
  formMode.value = null;
  resetFormErrors();
}

async function submitForm() {
  const mode = formMode.value;
  if (!mode || isSubmitting.value) return;

  formErrors.name = !appForm.name.trim();
  // Owner and initial status are mandatory when creating; legacy apps may lack an owner.
  formErrors.owner = mode === "create" && !appForm.owner.trim();
  formErrors.status = mode === "create" && !appForm.status;
  if (formErrors.name || formErrors.owner || formErrors.status) return;

  const payload = {
    name: appForm.name.trim(),
    description: appForm.description,
    owner: appForm.owner,
    status: appForm.status,
    logoUrl: appForm.logoUrl || null,
  };

  isSubmitting.value = true;
  try {
    if (mode === "create") await createApp(payload);
    else if (editingApp.value) await updateApp(editingApp.value.id, payload);
    closeFormModal();
  } finally {
    isSubmitting.value = false;
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function appUpdatedLabel(app: AppItem) {
  const date =
    app.latestVersion?.releaseDate ||
    app.latestVersion?.createdAt ||
    app.updatedAt;
  const ago = timeAgo(date);
  return ago ? `Updated ${ago}` : "Not updated yet";
}

const statusClass: Record<string, string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

const statusLabel: Record<string, string> = {
  active: "ACTIVE",
  draft: "DRAFT",
  maintenance: "MAINTENANCE",
};
</script>

<template>
  <div class="apps-page">
    <GeneralPageHeader
      title="Apps"
      :subtitle="pageSubtitle"
      :stats="headerStats"
      stats-label="App summary"
    >
      <template v-if="canCreateApp" #actions>
        <button type="button" class="btn btn-primary create-app-btn" @click="openCreateModal">
          Create App
        </button>
      </template>
      <template #filters>
        <GeneralSplitSearch
          v-model="searchQuery"
          placeholder="Search by docs name, keyword, version"
          label="Search apps, versions, and docs"
        >
          <template #prefix>
            <GeneralMultiSelectDropdown
              v-model="selectedAppIds"
              :options="appFilterOptions"
              all-label="All Apps"
              noun="apps"
              search-placeholder="Filter app name..."
              aria-label="Filter by app"
            />
          </template>
        </GeneralSplitSearch>
        <GeneralSearchableDropdown
          v-model="statusFilter"
          class="apps-filter apps-filter--status"
          :options="statusFilterOptions"
          placeholder="All Status"
          search-placeholder="Filter status..."
        />
        <GeneralSearchableDropdown
          v-model="sortKey"
          class="apps-filter"
          trigger-prefix="Sort :"
          :options="sortOptions"
          placeholder="Recently Updated"
          search-placeholder="Sort..."
        />
      </template>
    </GeneralPageHeader>

    <div class="section-head">
      <div class="section-head__copy">
        <h2>Your apps</h2>
        <span v-if="hasActiveFilters" class="result-count">
          {{ filteredApps.length }} {{ filteredApps.length === 1 ? "result" : "results" }}
        </span>
      </div>
    </div>

    <GeneralSkeletonAppGrid v-if="isLoading" />

    <div v-else-if="filteredApps.length === 0" class="empty-state">
      <p>No apps match your filters.</p>
      <button v-if="hasActiveFilters" type="button" class="btn btn-ghost" @click="clearFilters">
        Clear filters
      </button>
      <button
        v-else-if="canCreateApp"
        type="button"
        class="btn btn-primary"
        style="margin-top: 12px;"
        @click="openCreateModal"
      >
        Create your first app
      </button>
    </div>

    <div v-else class="app-grid">
      <article v-for="app in filteredApps" :key="app.id" class="app-card">
        <div class="app-card__top">
          <div class="app-card__identity">
            <AppLogo :name="app.name" :logo-url="app.logoUrl" />
            <div class="app-card__titles">
              <h3 class="app-card__name">
                <NuxtLink :to="drawerLink(app)" class="app-card__link">{{ app.name }}</NuxtLink>
              </h3>
              <p class="app-card__meta">{{ appUpdatedLabel(app) }}</p>
            </div>
          </div>
          <span class="pill" :class="statusClass[app.status] || 'pill-blue'">
            {{ statusLabel[app.status] || app.status.toUpperCase() }}
          </span>
        </div>

        <div
          class="action-dropdown-wrap actions-menu app-card__menu"
          :class="{ 'is-open': openAppMenu === app.id }"
        >
          <button
            type="button"
            class="btn btn-ghost btn-sm row-action row-action--icon"
            aria-label="More actions"
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
              :to="`/docs?app=${app.id}`"
              class="dropdown-item"
              role="menuitem"
              @click="openAppMenu = null"
            >
              Docs
            </NuxtLink>
            <NuxtLink
              :to="`/versions?app=${app.id}`"
              class="dropdown-item"
              role="menuitem"
              @click="openAppMenu = null"
            >
              Versions
            </NuxtLink>
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
              Delete
            </button>
          </div>
        </div>
      </article>
    </div>

    <section class="activity-section" aria-labelledby="activity-heading">
      <div class="activity-head">
        <div class="activity-head__copy">
          <h2 id="activity-heading">Recent activity</h2>
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
          Refresh
        </button>
      </div>

      <div v-if="activityContributors.length" class="contributor-row" aria-label="Active contributors">
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
              <th>Date</th>
              <th>App</th>
              <th>Action</th>
              <th>User</th>
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
              <td colspan="4" class="empty-row">No activity yet</td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </div>
    </section>

    <!-- Create / Edit Modal -->
    <div class="modal-overlay" :class="{ open: showFormModal }" @click.self="closeFormModal">
      <div
        class="modal modal--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appFormTitle"
      >
        <div class="modal-header">
          <h2 id="appFormTitle">{{ formMode === "edit" ? "Edit App" : "Create App" }}</h2>
          <button type="button" class="modal-close" aria-label="Close" @click="closeFormModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form novalidate @submit.prevent="submitForm">
          <div class="modal-body">
            <div class="form-group" :class="{ 'has-error': formErrors.name }">
              <label for="appName">App Name <span class="req" aria-hidden="true">*</span></label>
              <input
                id="appName"
                v-model="appForm.name"
                type="text"
                placeholder="E.g. Payment Gateway"
                required
                :aria-invalid="formErrors.name"
                aria-describedby="appNameError"
                @input="formErrors.name = false"
              />
              <span id="appNameError" class="error-msg" :class="{ show: formErrors.name }">
                App name is required
              </span>
            </div>

            <div class="form-group">
              <label for="appDesc">
                Description <span class="opt">(optional)</span>
              </label>
              <textarea id="appDesc" v-model="appForm.description" placeholder="What does this app do?" />
            </div>

            <div class="form-row">
              <div class="form-group" :class="{ 'has-error': formErrors.owner }">
                <label for="appOwner">
                  Owner <span v-if="formMode === 'create'" class="req" aria-hidden="true">*</span>
                </label>
                <AppOwnerSelect
                  id="appOwner"
                  v-model="appForm.owner"
                  placeholder="Choose Owner"
                  @update:model-value="formErrors.owner = false"
                />
                <span class="error-msg" :class="{ show: formErrors.owner }">Choose an owner</span>
              </div>
              <div class="form-group" :class="{ 'has-error': formErrors.status }">
                <label for="appStatus">
                  {{ formMode === "edit" ? "Status" : "Initial Status" }}
                  <span v-if="formMode === 'create'" class="req" aria-hidden="true">*</span>
                </label>
                <GeneralSearchableDropdown
                  id="appStatus"
                  v-model="appForm.status"
                  block
                  :searchable="false"
                  :options="formStatusOptions"
                  placeholder="Choose Initial status"
                  @update:model-value="formErrors.status = false"
                />
                <span class="error-msg" :class="{ show: formErrors.status }">
                  Choose an initial status
                </span>
              </div>
            </div>

            <div class="form-group">
              <GeneralLogoUploadField
                v-model="appForm.logoUrl"
                input-id="appLogo"
                label="Logo"
                optional-label="(optional)"
                url-placeholder="E.g. https://cdn.example.com/product-logo.svg"
                drop-hint="Drop an image here, or"
                browse-label="browse"
                remove-label="Remove"
                url-label="Or paste a URL"
              />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-form btn-form--outline" @click="closeFormModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-form btn-form--solid" :disabled="isSubmitting">
              <template v-if="formMode === 'edit'">{{ isSubmitting ? "Saving…" : "Save" }}</template>
              <template v-else>{{ isSubmitting ? "Creating…" : "Create App" }}</template>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!appToDelete }" @click.self="appToDelete = null">
      <div class="modal modal--narrow">
        <div class="modal-header">
          <h2>Delete App</h2>
          <button type="button" class="modal-close" aria-label="Close" @click="appToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-text">
            Delete <strong>{{ appToDelete?.name }}</strong>? This can't be undone.
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

    <AppDetailDrawer
      v-if="drawerAppId"
      :app="drawerApp"
      :tab="drawerTab"
      :can-edit="canEditApp"
      :can-generate-docs="canGenerateDocs"
      @close="closeDrawer"
      @edit="openEditModal"
      @update:tab="setDrawerTab"
    />
  </div>
</template>

<style scoped>
.apps-page {
  /* Inherits global semantic tokens from :root */
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

.create-app-btn {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.create-app-btn:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent-strong) 88%, black);
}

.apps-filter :deep(.dropdown-trigger) {
  min-height: 39px;
  min-width: 0;
  font-weight: 500;
  border-color: var(--control-border);
}

.apps-filter :deep(.dropdown-trigger:hover) {
  border-color: var(--fg);
}

.apps-filter--status :deep(.dropdown-trigger) {
  min-width: 158px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 36px;
}

.app-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.app-card__link {
  color: inherit;
  text-decoration: none;
}

.app-card__link::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.app-card__link:focus-visible {
  outline: none;
}

.app-card:has(.app-card__link:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

.app-card__meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
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

.app-card__menu {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.app-card:hover .app-card__menu,
.app-card:focus-within .app-card__menu,
.app-card__menu.is-open {
  opacity: 1;
}

@media (hover: none) {
  .app-card__menu {
    opacity: 1;
  }
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
  color: var(--error-text);
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

.activity-panel :deep(th:nth-child(1)) {
  width: 10%;
}

.activity-panel :deep(th:nth-child(3)),
.activity-panel :deep(th:nth-child(4)) {
  width: 19%;
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
  background: color-mix(in oklch, var(--success) 12%, transparent);
  color: var(--success-text);
}

.pill-amber {
  background: color-mix(in oklch, var(--warning) 12%, transparent);
  color: var(--warning-text);
}

.pill-blue {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
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
  min-height: 72px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid var(--control-border);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  transition: border-color 0.15s;
}

.modal-close:hover {
  border-color: var(--fg);
}

.modal-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.modal-body {
  padding: 24px;
}

.modal-text {
  margin: 0;
  color: var(--muted);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.btn-form {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--accent-strong);
}

.btn-form--outline {
  background: var(--surface);
  color: var(--accent-strong);
}

.btn-form--outline:hover:not(:disabled) {
  background: var(--accent-soft);
}

.btn-form--solid {
  background: var(--accent-strong);
  color: var(--surface);
}

.btn-form--solid:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent-strong) 88%, black);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--fg);
}

.form-group label .opt {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}

.form-group label .req {
  color: var(--accent-strong);
}

.error-msg {
  display: none;
  color: var(--error-text);
  font-size: 12px;
  margin-top: 4px;
}

.error-msg.show {
  display: block;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--muted);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-group.has-error input,
.form-group.has-error :deep(.owner-trigger),
.form-group.has-error :deep(.dropdown-trigger) {
  border-color: var(--error);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--error) 20%, transparent);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .app-grid {
    grid-template-columns: 1fr;
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
