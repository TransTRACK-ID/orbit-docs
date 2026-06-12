<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { FeedbackItem, InternalFeedbackItem } from "~/types";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Feedback");
});

type FeedbackTab = "public" | "internal";

const activeTab = ref<FeedbackTab>("public");

const { apps, fetchApps } = useApps();
const { docs: publishedDocs, fetchDocs } = useDocs();
const { currentMember, fetchCurrentMember } = useSettings();

const isSuperAdmin = computed(() => currentMember.value?.role === "admin");

const firstPublishedDoc = computed(() =>
  publishedDocs.value.find((d) => d.status === "published") ?? null
);
const {
  feedbackItems,
  stats,
  isLoading,
  isUpdating,
  isDeleting,
  fetchFeedback,
  updateFeedbackStatus,
  deleteFeedback,
} = useFeedback();

const {
  feedbackItems: internalItems,
  stats: internalStats,
  isLoading: isLoadingInternal,
  isUpdating: isUpdatingInternal,
  isDeleting: isDeletingInternal,
  fetchInternalFeedback,
  updateInternalFeedbackStatus,
  deleteInternalFeedback,
} = useInternalFeedback();

const searchQuery = ref("");
const appFilter = ref("");
const statusFilter = ref("");
const helpfulFilter = ref("");

const internalSearchQuery = ref("");
const internalStatusFilter = ref("");
const internalCategoryFilter = ref("");

const showDeleteModal = ref(false);
const feedbackToDelete = ref<FeedbackItem | null>(null);
const internalToDelete = ref<InternalFeedbackItem | null>(null);

const appFilterOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

const statusFilterOptions = computed(() => [
  { id: "", label: "All statuses" },
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
]);

const helpfulFilterOptions = computed(() => [
  { id: "", label: "All ratings" },
  { id: "true", label: "Helpful" },
  { id: "false", label: "Not helpful" },
]);

const internalCategoryOptions = computed(() => [
  { id: "", label: "All categories" },
  { id: "general", label: "General" },
  { id: "bug", label: "Bug report" },
  { id: "feature", label: "Feature request" },
  { id: "docs", label: "Documentation" },
]);

const tabSubtitle = computed(() => {
  if (activeTab.value === "internal") {
    return "About Orbit Docs, from signed-in team members";
  }
  return "Collected on public doc pages after publish";
});

onMounted(async () => {
  await Promise.all([
    fetchApps(),
    fetchDocs({ status: "published" }),
    fetchCurrentMember(),
    loadFeedback(),
  ]);
});

async function loadFeedback() {
  if (activeTab.value === "internal") {
    if (!isSuperAdmin.value) return;
    await fetchInternalFeedback({
      search: internalSearchQuery.value.trim() || undefined,
      status: internalStatusFilter.value || undefined,
      category: internalCategoryFilter.value || undefined,
    });
    return;
  }
  await fetchFeedback({
    search: searchQuery.value.trim() || undefined,
    app: appFilter.value || undefined,
    status: statusFilter.value || undefined,
    helpful: helpfulFilter.value || undefined,
  });
}

watch([searchQuery, appFilter, statusFilter, helpfulFilter], () => {
  if (activeTab.value === "public") loadFeedback();
});

watch([internalSearchQuery, internalStatusFilter, internalCategoryFilter], () => {
  if (activeTab.value === "internal") loadFeedback();
});

watch(activeTab, (tab) => {
  if (tab === "internal" && !isSuperAdmin.value) {
    activeTab.value = "public";
    return;
  }
  loadFeedback();
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function changeStatus(item: FeedbackItem, status: FeedbackItem["status"]) {
  if (item.status === status || isUpdating.value) return;
  await updateFeedbackStatus(item.id, status);
  await loadFeedback();
}

async function changeInternalStatus(item: InternalFeedbackItem, status: InternalFeedbackItem["status"]) {
  if (item.status === status || isUpdatingInternal.value) return;
  await updateInternalFeedbackStatus(item.id, status);
  await loadFeedback();
}

function confirmDelete(item: FeedbackItem) {
  feedbackToDelete.value = item;
  showDeleteModal.value = true;
}

function confirmDeleteInternal(item: InternalFeedbackItem) {
  internalToDelete.value = item;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  feedbackToDelete.value = null;
  internalToDelete.value = null;
}

async function doDelete() {
  if (isDeleting.value || isDeletingInternal.value) return;
  if (internalToDelete.value) {
    await deleteInternalFeedback(internalToDelete.value.id);
  } else if (feedbackToDelete.value) {
    await deleteFeedback(feedbackToDelete.value.id);
  } else {
    return;
  }
  closeDeleteModal();
  await loadFeedback();
}

const statusClass: Record<string, string> = {
  open: "pill-amber",
  resolved: "pill-green",
  closed: "pill-muted",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

const categoryLabel: Record<string, string> = {
  general: "General",
  bug: "Bug report",
  feature: "Feature request",
  docs: "Documentation",
};

const categoryClass: Record<string, string> = {
  general: "pill-muted",
  bug: "pill-red",
  feature: "pill-blue",
  docs: "pill-green",
};
</script>

<template>
  <div class="feedback-page">
    <header class="topbar">
      <div class="flex-gap-md topbar-title">
        <h1>Feedback</h1>
        <span class="text-muted-sm">{{ tabSubtitle }}</span>
      </div>
      <div v-if="activeTab === 'public'" class="flex-gap-md">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search feedback…"
          aria-label="Search feedback"
        />
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="Filter by app…"
          search-placeholder="Search apps…"
        />
      </div>
      <div v-else class="flex-gap-md">
        <input
          v-model="internalSearchQuery"
          class="search"
          placeholder="Search Orbit Docs feedback…"
          aria-label="Search Orbit Docs feedback"
        />
      </div>
    </header>

    <div v-if="isSuperAdmin" class="feedback-tabs" role="tablist" aria-label="Feedback source">
      <button
        type="button"
        role="tab"
        class="feedback-tab"
        :class="{ active: activeTab === 'public' }"
        :aria-selected="activeTab === 'public'"
        @click="activeTab = 'public'"
      >
        Public docs
      </button>
      <button
        type="button"
        role="tab"
        class="feedback-tab"
        :class="{ active: activeTab === 'internal' }"
        :aria-selected="activeTab === 'internal'"
        @click="activeTab = 'internal'"
      >
        Internal · Orbit Docs
      </button>
    </div>

    <div class="row-between">
      <div>
        <template v-if="activeTab === 'public' && isLoading">
          <h2 class="section-title">
            <span class="loading-spinner" /> Loading…
          </h2>
          <p class="text-muted-sm section-sub">Fetching submissions</p>
        </template>
        <template v-else-if="activeTab === 'public'">
          <h2 class="section-title">
            {{ stats.total }} submission{{ stats.total === 1 ? "" : "s" }}
          </h2>
          <p class="text-muted-sm section-sub">
            <span class="num">{{ stats.helpful }}</span> helpful
            · <span class="num">{{ stats.notHelpful }}</span> not helpful
            · <span class="num">{{ stats.open }}</span> open
          </p>
        </template>
        <template v-else-if="isLoadingInternal">
          <h2 class="section-title">
            <span class="loading-spinner" /> Loading…
          </h2>
          <p class="text-muted-sm section-sub">Fetching internal submissions</p>
        </template>
        <template v-else>
          <h2 class="section-title">
            {{ internalStats.total }} submission{{ internalStats.total === 1 ? "" : "s" }}
          </h2>
          <p class="text-muted-sm section-sub">
            <span class="num">{{ internalStats.open }}</span> open
            · admin only
          </p>
        </template>
      </div>
      <div v-if="activeTab === 'public'" class="flex-gap-sm filter-group">
        <GeneralSearchableDropdown
          v-model="statusFilter"
          :options="statusFilterOptions"
          placeholder="All statuses"
          search-placeholder="Filter status…"
        />
        <GeneralSearchableDropdown
          v-model="helpfulFilter"
          :options="helpfulFilterOptions"
          placeholder="All ratings"
          search-placeholder="Filter rating…"
        />
      </div>
      <div v-else class="flex-gap-sm filter-group">
        <GeneralSearchableDropdown
          v-model="internalStatusFilter"
          :options="statusFilterOptions"
          placeholder="All statuses"
          search-placeholder="Filter status…"
        />
        <GeneralSearchableDropdown
          v-model="internalCategoryFilter"
          :options="internalCategoryOptions"
          placeholder="All categories"
          search-placeholder="Filter category…"
        />
      </div>
    </div>

    <!-- Public doc feedback -->
    <div v-if="activeTab === 'public'" class="card table-card">
      <table class="ds-table">
        <thead>
          <tr>
            <th>Doc / App</th>
            <th>Rating</th>
            <th>Comment</th>
            <th>Status</th>
            <th>Submitted</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="6" class="empty-cell">
              <span class="loading-spinner" /> Loading feedback…
            </td>
          </tr>
          <tr v-else-if="feedbackItems.length === 0">
            <td colspan="6" class="empty-cell">
              <div class="empty-state">
                <p class="empty-title">No feedback yet</p>
                <p class="empty-desc">Collected from published doc pages, not here.</p>
                <div class="empty-actions">
                  <NuxtLink to="/docs" class="btn btn-primary btn-sm">Go to Docs</NuxtLink>
                  <NuxtLink
                    v-if="firstPublishedDoc"
                    :to="`/p/${firstPublishedDoc.id}#docFeedback`"
                    target="_blank"
                    class="btn btn-secondary btn-sm"
                  >
                    View public page
                  </NuxtLink>
                </div>
              </div>
            </td>
          </tr>
          <tr v-for="item in feedbackItems" v-else :key="item.id">
            <td>
              <NuxtLink :to="`/p/${item.docId}`" target="_blank" class="item-title item-link">
                {{ item.docTitle || "Untitled doc" }}
              </NuxtLink>
              <div class="item-sub">{{ item.appName || "—" }}</div>
            </td>
            <td>
              <span :class="['pill', item.helpful ? 'pill-green' : 'pill-red']">
                {{ item.helpful ? "Helpful" : "Not helpful" }}
              </span>
            </td>
            <td class="comment-cell">
              <span v-if="item.comment">{{ item.comment }}</span>
              <span v-else class="cell-muted">—</span>
            </td>
            <td>
              <span :class="['pill', statusClass[item.status] || 'pill-amber']">
                {{ statusLabel[item.status] || item.status }}
              </span>
            </td>
            <td class="num cell-muted">{{ formatDate(item.createdAt) }}</td>
            <td class="actions-col">
              <div class="row-actions">
                <select
                  class="select select-sm"
                  :value="item.status"
                  aria-label="Change status"
                  @change="changeStatus(item, ($event.target as HTMLSelectElement).value as FeedbackItem['status'])"
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  title="Delete feedback"
                  @click="confirmDelete(item)"
                >
                  <IconsTrash size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Internal app feedback (admin only) -->
    <div v-else class="card table-card">
      <table class="ds-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Comment</th>
            <th>Submitted by</th>
            <th>Status</th>
            <th>Submitted</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoadingInternal">
            <td colspan="6" class="empty-cell">
              <span class="loading-spinner" /> Loading Orbit Docs feedback…
            </td>
          </tr>
          <tr v-else-if="internalItems.length === 0">
            <td colspan="6" class="empty-cell">
              <div class="empty-state">
                <p class="empty-title">No platform feedback yet</p>
                <p class="empty-desc">
                  Team members can share feedback about Orbit Docs from the floating button on any signed-in page.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="item in internalItems" v-else :key="item.id">
            <td>
              <span :class="['pill', categoryClass[item.category] || 'pill-muted']">
                {{ categoryLabel[item.category] || item.category }}
              </span>
            </td>
            <td class="comment-cell">
              <span>{{ item.comment }}</span>
            </td>
            <td>
              <div class="item-title">{{ item.userName }}</div>
              <div v-if="item.userEmail" class="item-sub">{{ item.userEmail }}</div>
            </td>
            <td>
              <span :class="['pill', statusClass[item.status] || 'pill-amber']">
                {{ statusLabel[item.status] || item.status }}
              </span>
            </td>
            <td class="num cell-muted">{{ formatDate(item.createdAt) }}</td>
            <td class="actions-col">
              <div class="row-actions">
                <select
                  class="select select-sm"
                  :value="item.status"
                  aria-label="Change status"
                  @change="changeInternalStatus(item, ($event.target as HTMLSelectElement).value as InternalFeedbackItem['status'])"
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  title="Delete feedback"
                  @click="confirmDeleteInternal(item)"
                >
                  <IconsTrash size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" :class="{ open: showDeleteModal }" @click.self="closeDeleteModal">
      <div class="modal-panel delete-modal">
        <div class="modal-header">
          <h2>Delete Feedback</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeDeleteModal">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-text">
            Are you sure you want to delete this feedback submission? This action cannot be undone.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="closeDeleteModal">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting || isDeletingInternal" @click="doDelete">
            <span v-if="isDeleting || isDeletingInternal">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feedback-page {
  /* inherits global tokens */
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

.flex-gap-sm {
  display: flex;
  gap: 8px;
  align-items: center;
}
.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
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

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.section-sub {
  margin: 4px 0 0;
}

.filter-group {
  flex-shrink: 0;
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
.actions-col {
  width: 160px;
  text-align: right;
}

.empty-cell {
  text-align: center;
  color: var(--muted);
  padding: 40px 24px;
}

.empty-state {
  max-width: 320px;
  margin: 0 auto;
  text-align: center;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}

.empty-desc {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
}

.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.item-link {
  text-decoration: none;
  color: inherit;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.item-link:hover {
  color: var(--accent);
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.item-title {
  font-weight: 600;
  font-size: 14px;
}

.item-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.comment-cell {
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-muted {
  color: var(--muted);
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
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
.select-sm {
  min-width: 110px;
  font-size: 12px;
  padding: 4px 8px;
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
.pill-red {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(50% 0.14 25);
}
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}
.pill-blue {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.feedback-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 20px;
  background: var(--fg-soft);
  border-radius: var(--radius);
}
.feedback-tab {
  padding: 6px 14px;
  border: none;
  border-radius: calc(var(--radius) - 2px);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.feedback-tab:hover {
  color: var(--fg);
}
.feedback-tab.active {
  background: var(--surface);
  color: var(--fg);
  box-shadow: 0 1px 2px color-mix(in oklch, var(--fg) 8%, transparent);
}
.feedback-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.topbar-title {
  flex-wrap: wrap;
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
  text-decoration: none;
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
  color: oklch(99% 0.004 250);
  border-color: var(--accent);
}
.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
  border-color: color-mix(in oklch, var(--accent) 88%, black);
  color: oklch(99% 0.004 250);
}
.btn-secondary {
  background: var(--surface);
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: color-mix(in oklch, var(--fg) 28%, var(--border));
  background: var(--fg-soft);
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
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
.delete-modal {
  max-width: 420px;
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
.modal-text {
  margin: 0;
  color: var(--muted);
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .search {
    width: 180px;
  }
  .topbar,
  .row-between {
    flex-wrap: wrap;
  }
  .filter-group {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-panel,
  .btn,
  .search,
  .select,
  .loading-spinner {
    transition: none !important;
    animation: none !important;
  }
}
</style>
