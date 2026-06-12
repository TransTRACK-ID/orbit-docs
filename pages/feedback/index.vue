<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { FeedbackItem } from "~/types";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Feedback");
});

const { apps, fetchApps } = useApps();
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

const searchQuery = ref("");
const appFilter = ref("");
const statusFilter = ref("");
const helpfulFilter = ref("");

const showDeleteModal = ref(false);
const feedbackToDelete = ref<FeedbackItem | null>(null);

const appFilterOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

onMounted(async () => {
  await fetchApps();
  await loadFeedback();
});

async function loadFeedback() {
  await fetchFeedback({
    search: searchQuery.value.trim() || undefined,
    app: appFilter.value || undefined,
    status: statusFilter.value || undefined,
    helpful: helpfulFilter.value || undefined,
  });
}

watch([searchQuery, appFilter, statusFilter, helpfulFilter], () => {
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

function confirmDelete(item: FeedbackItem) {
  feedbackToDelete.value = item;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  feedbackToDelete.value = null;
}

async function doDelete() {
  if (!feedbackToDelete.value || isDeleting.value) return;
  await deleteFeedback(feedbackToDelete.value.id);
  closeDeleteModal();
  await loadFeedback();
}

function statusPillClass(status: string) {
  if (status === "resolved") return "pill-green";
  if (status === "closed") return "pill-gray";
  return "pill-amber";
}
</script>

<template>
  <div class="feedback-page">
    <header class="topbar">
      <h1>Feedback</h1>
      <div class="topbar-actions">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search feedback…"
          aria-label="Search feedback"
        />
        <select v-model="appFilter" class="select" aria-label="Filter by app">
          <option v-for="opt in appFilterOptions" :key="opt.id" :value="opt.id">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="statusFilter" class="select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select v-model="helpfulFilter" class="select" aria-label="Filter by rating">
          <option value="">All ratings</option>
          <option value="true">Helpful</option>
          <option value="false">Not helpful</option>
        </select>
      </div>
    </header>

    <div class="stats-bar">
      <div class="stat">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.helpful }}</span>
        <span class="stat-label">Helpful</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.notHelpful }}</span>
        <span class="stat-label">Not helpful</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.open }}</span>
        <span class="stat-label">Open</span>
      </div>
    </div>

    <div class="row-between" style="margin-bottom: 16px;">
      <h2>User submissions</h2>
    </div>

    <div v-if="isLoading" class="card" style="padding: 32px;">
      <div class="animate-pulse space-y-3">
        <div class="h-4 bg-gray-200 rounded w-3/4" />
        <div class="h-3 bg-gray-200 rounded w-1/2" />
        <div class="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    </div>

    <div v-else-if="feedbackItems.length === 0" class="empty-state">
      <p>No feedback yet. Responses from published docs will appear here.</p>
    </div>

    <div v-else class="card" style="padding: 0; overflow: hidden;">
      <table class="ds-table">
        <thead>
          <tr>
            <th>Doc / App</th>
            <th>Rating</th>
            <th>Comment</th>
            <th>Status</th>
            <th>Submitted</th>
            <th style="width: 160px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in feedbackItems" :key="item.id">
            <td>
              <div class="item-title">{{ item.docTitle || "Untitled doc" }}</div>
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
              <span :class="['pill', statusPillClass(item.status)]">{{ item.status }}</span>
            </td>
            <td class="num cell-muted">{{ formatDate(item.createdAt) }}</td>
            <td style="text-align: right;">
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
                  class="btn btn-ghost btn-sm action-btn"
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

    <div class="modal-overlay" :class="{ open: showDeleteModal }" @click.self="closeDeleteModal">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Feedback</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeDeleteModal">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to delete this feedback submission? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="closeDeleteModal">
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
.feedback-page {
  padding: 24px 32px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.topbar h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search {
  min-width: 200px;
}

.select {
  min-width: 140px;
}

.select-sm {
  min-width: 110px;
  font-size: 12px;
  padding: 4px 8px;
}

.stats-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: var(--muted);
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

.pill-red {
  background: color-mix(in oklch, var(--od-error) 12%, transparent);
  color: var(--od-error-text);
}

.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.15 85) 15%, transparent);
  color: oklch(55% 0.12 75);
}

.pill-gray {
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  color: var(--muted);
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--muted);
}
</style>
