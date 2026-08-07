<script setup lang="ts">
import { toast } from "vue3-toastify";
import { formatDistanceToNow } from "date-fns";
import type { AdrStatus } from "~/types/adr";
import { ADR_STATUSES } from "~/types/adr";

export interface AdrListItem {
  id: string;
  appId: string | null;
  title: string;
  adrNumber: number | null;
  displayLabel: string;
  adrStatus: AdrStatus;
  docStatus: string;
  binding: boolean;
  scope: string[];
  updatedAt: string | null;
  app: { id: string; name: string } | null;
}

const { can } = usePermissions();
const { apps, fetchApps } = useApps();

const adrs = ref<AdrListItem[]>([]);
const isLoading = ref(true);
const isCreating = ref(false);
const selectedAppId = ref("");
const showCreateModal = ref(false);
const createTitle = ref("");
const createAppId = ref("");
const supersedeTarget = ref<AdrListItem | null>(null);
const replacementAdrId = ref("");
const actionLoadingId = ref<string | null>(null);
const selectedAdrIds = ref<Set<string>>(new Set());
const isBulkUpdating = ref(false);

const canWrite = computed(() => can("adrs:write"));
const canPublish = computed(() => can("adrs:publish"));

const selectedCount = computed(() => selectedAdrIds.value.size);
const allVisibleSelected = computed(
  () =>
    filteredAdrs.value.length > 0 &&
    filteredAdrs.value.every((adr) => selectedAdrIds.value.has(adr.id))
);
const someVisibleSelected = computed(() =>
  filteredAdrs.value.some((adr) => selectedAdrIds.value.has(adr.id))
);

function toggleAdrSelection(id: string) {
  const next = new Set(selectedAdrIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedAdrIds.value = next;
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    selectedAdrIds.value = new Set();
    return;
  }
  selectedAdrIds.value = new Set(filteredAdrs.value.map((adr) => adr.id));
}

function clearSelection() {
  selectedAdrIds.value = new Set();
}

async function runBulkAction(
  label: string,
  action: (adr: AdrListItem) => Promise<void>
) {
  const targets = filteredAdrs.value.filter((adr) => selectedAdrIds.value.has(adr.id));
  if (targets.length === 0) return;

  isBulkUpdating.value = true;
  let succeeded = 0;
  let failed = 0;

  for (const adr of targets) {
    try {
      await action(adr);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  isBulkUpdating.value = false;
  clearSelection();
  await fetchAdrs();

  if (failed === 0) {
    toast.success(`${label}: ${succeeded} ADR(s) updated`);
  } else {
    toast.warning(`${label}: ${succeeded} succeeded, ${failed} failed`);
  }
}

async function bulkAccept() {
  await runBulkAction("Accept", acceptAdrApi);
}

async function bulkPublish() {
  await runBulkAction("Publish", publishAdrApi);
}

async function bulkArchive() {
  await runBulkAction("Archive", archiveAdrApi);
}

const summary = computed(() => {
  const counts = {
    binding: 0,
    proposed: 0,
    superseded: 0,
    deprecated: 0,
  };

  for (const adr of filteredAdrs.value) {
    if (adr.binding) counts.binding += 1;
    else if (adr.adrStatus === "proposed") counts.proposed += 1;
    else if (adr.adrStatus === "superseded") counts.superseded += 1;
    else if (adr.adrStatus === "deprecated") counts.deprecated += 1;
  }

  return counts;
});

const filteredAdrs = computed(() => {
  if (!selectedAppId.value) return adrs.value;
  return adrs.value.filter((adr) => adr.appId === selectedAppId.value);
});

const replacementOptions = computed(() => {
  if (!supersedeTarget.value) return [];
  return adrs.value.filter(
    (adr) =>
      adr.id !== supersedeTarget.value?.id &&
      adr.appId === supersedeTarget.value?.appId &&
      adr.adrStatus !== "superseded"
  );
});

const adrStatusLabel: Record<AdrStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  deprecated: "Deprecated",
  superseded: "Superseded",
};

const adrStatusClass: Record<AdrStatus, string> = {
  proposed: "pill-amber",
  accepted: "pill-green",
  deprecated: "pill-amber",
  superseded: "pill-blue",
};

const docStatusLabel: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  archived: "Archived",
};

async function fetchAdrs() {
  isLoading.value = true;
  try {
    const { data } = await $fetch<{ data: AdrListItem[] }>("/api/settings/adrs", {
      query: {
        includeContent: "false",
        ...(selectedAppId.value ? { appId: selectedAppId.value } : {}),
      },
    });
    adrs.value = data;
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to load architectural decisions");
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  createTitle.value = "";
  createAppId.value =
    selectedAppId.value || (apps.value.length === 1 ? apps.value[0]!.id : "");
  showCreateModal.value = true;
}

async function createAdr() {
  if (!createTitle.value.trim()) {
    toast.error("Title is required");
    return;
  }
  if (!createAppId.value) {
    toast.error("Select an app");
    return;
  }

  isCreating.value = true;
  try {
    const { data } = await $fetch<{ data: { id: string } }>("/api/settings/adrs", {
      method: "POST",
      body: {
        title: createTitle.value.trim(),
        appId: createAppId.value,
      },
    });
    showCreateModal.value = false;
    await fetchAdrs();
    await navigateTo(`/docs/${data.id}`);
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to create ADR");
  } finally {
    isCreating.value = false;
  }
}

async function acceptAdrApi(adr: AdrListItem) {
  await $fetch(`/api/settings/adrs/${adr.id}/accept`, { method: "POST" });
}

async function publishAdrApi(adr: AdrListItem) {
  await $fetch(`/api/settings/adrs/${adr.id}`, {
    method: "PUT",
    body: { status: "published" },
  });
}

async function archiveAdrApi(adr: AdrListItem) {
  await $fetch(`/api/settings/adrs/${adr.id}`, {
    method: "PUT",
    body: { status: "archived" },
  });
}

async function acceptAdr(adr: AdrListItem) {
  actionLoadingId.value = adr.id;
  try {
    await acceptAdrApi(adr);
    toast.success("ADR accepted");
    await fetchAdrs();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to accept ADR");
  } finally {
    actionLoadingId.value = null;
  }
}

async function publishAdr(adr: AdrListItem) {
  actionLoadingId.value = adr.id;
  try {
    await publishAdrApi(adr);
    toast.success("ADR published");
    await fetchAdrs();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to publish ADR");
  } finally {
    actionLoadingId.value = null;
  }
}

async function archiveAdr(adr: AdrListItem) {
  actionLoadingId.value = adr.id;
  try {
    await archiveAdrApi(adr);
    toast.success("ADR archived");
    await fetchAdrs();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to archive ADR");
  } finally {
    actionLoadingId.value = null;
  }
}

function openSupersedeModal(adr: AdrListItem) {
  supersedeTarget.value = adr;
  replacementAdrId.value = "";
}

async function confirmSupersede() {
  if (!supersedeTarget.value || !replacementAdrId.value) return;
  actionLoadingId.value = supersedeTarget.value.id;
  try {
    await $fetch(`/api/settings/adrs/${supersedeTarget.value.id}/supersede`, {
      method: "POST",
      body: { replacementAdrId: replacementAdrId.value },
    });
    toast.success("ADR superseded");
    supersedeTarget.value = null;
    await fetchAdrs();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to supersede ADR");
  } finally {
    actionLoadingId.value = null;
  }
}

function relativeTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

watch(selectedAppId, () => {
  clearSelection();
  void fetchAdrs();
});

onMounted(async () => {
  await fetchApps();
  if (apps.value.length === 1) {
    selectedAppId.value = apps.value[0]!.id;
  }
  await fetchAdrs();
});
</script>

<template>
  <div class="adr-manager">
    <div class="adr-header row-between">
      <div>
        <h3>Architectural Decisions</h3>
        <p class="desc">Binding rules agents must follow when making architecture or design recommendations.</p>
      </div>
      <button
        v-if="canWrite"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="apps.length === 0"
        @click="openCreateModal"
      >
        + New ADR
      </button>
    </div>

    <div class="adr-toolbar">
      <div class="form-group adr-app-filter">
        <label for="adrAppFilter">App</label>
        <select id="adrAppFilter" v-model="selectedAppId" class="select">
          <option value="">All apps</option>
          <option v-for="app in apps" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>
      </div>

      <div class="adr-summary">
        <span class="adr-summary-item"><strong>{{ summary.binding }}</strong> binding</span>
        <span class="adr-summary-item"><strong>{{ summary.proposed }}</strong> proposed</span>
        <span class="adr-summary-item"><strong>{{ summary.superseded }}</strong> superseded</span>
        <span class="adr-summary-item"><strong>{{ summary.deprecated }}</strong> deprecated</span>
      </div>
    </div>

    <div v-if="selectedCount > 0" class="adr-bulk-bar">
      <span class="adr-bulk-count">{{ selectedCount }} selected</span>
      <button
        v-if="canWrite"
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isBulkUpdating"
        @click="bulkAccept"
      >
        Accept
      </button>
      <button
        v-if="canPublish"
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isBulkUpdating"
        @click="bulkPublish"
      >
        Publish
      </button>
      <button
        v-if="canPublish"
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isBulkUpdating"
        @click="bulkArchive"
      >
        Archive
      </button>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="isBulkUpdating" @click="clearSelection">
        Clear
      </button>
    </div>

    <div v-if="isLoading" class="skeleton-wrap">
      <div class="skeleton-line w-full" />
      <div class="skeleton-line w-full" />
      <div class="skeleton-line w-2/3" />
    </div>

    <div v-else-if="filteredAdrs.length === 0" class="adr-empty">
      <p class="adr-empty-title">No architectural decisions yet</p>
      <p class="adr-empty-desc">
        {{
          selectedAppId
            ? "Create the first ADR for this app to define binding constraints for agents."
            : "Create an ADR and choose which app it applies to."
        }}
      </p>
      <button
        v-if="canWrite"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="apps.length === 0"
        @click="openCreateModal"
      >
        + New ADR
      </button>
    </div>

    <table v-else class="ds-table">
      <thead>
        <tr>
          <th v-if="canWrite || canPublish" class="check-col">
            <input
              type="checkbox"
              class="row-check"
              :checked="allVisibleSelected"
              :indeterminate.prop="someVisibleSelected && !allVisibleSelected"
              :disabled="isBulkUpdating || filteredAdrs.length === 0"
              aria-label="Select all visible ADRs"
              @change="toggleSelectAllVisible"
            />
          </th>
          <th>ADR</th>
          <th v-if="!selectedAppId">App</th>
          <th>ADR status</th>
          <th>Doc status</th>
          <th>Binding</th>
          <th>Scope</th>
          <th>Updated</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="adr in filteredAdrs" :key="adr.id" :class="{ 'is-selected': selectedAdrIds.has(adr.id) }">
          <td v-if="canWrite || canPublish" class="check-col">
            <input
              type="checkbox"
              class="row-check"
              :checked="selectedAdrIds.has(adr.id)"
              :disabled="isBulkUpdating"
              :aria-label="`Select ${adr.displayLabel}`"
              @change="toggleAdrSelection(adr.id)"
            />
          </td>
          <td>
            <NuxtLink :to="`/docs/${adr.id}`" class="adr-link">
              {{ adr.displayLabel }}
            </NuxtLink>
          </td>
          <td v-if="!selectedAppId">{{ adr.app?.name || "—" }}</td>
          <td>
            <span class="pill" :class="adrStatusClass[adr.adrStatus]">
              {{ adrStatusLabel[adr.adrStatus] }}
            </span>
          </td>
          <td>{{ docStatusLabel[adr.docStatus] || adr.docStatus }}</td>
          <td>
            <span v-if="adr.binding" class="adr-binding-yes" title="Binding">✓</span>
            <span v-else class="adr-binding-no">—</span>
          </td>
          <td>{{ adr.scope.length ? adr.scope.join(", ") : "All" }}</td>
          <td class="num">{{ relativeTime(adr.updatedAt) }}</td>
          <td class="adr-actions">
            <NuxtLink :to="`/docs/${adr.id}`" class="btn btn-ghost btn-sm">Edit</NuxtLink>
            <button
              v-if="canWrite && adr.adrStatus !== 'accepted'"
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="actionLoadingId === adr.id"
              @click="acceptAdr(adr)"
            >
              Accept
            </button>
            <button
              v-if="canPublish && adr.docStatus !== 'published'"
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="actionLoadingId === adr.id"
              @click="publishAdr(adr)"
            >
              Publish
            </button>
            <button
              v-if="canWrite && adr.adrStatus !== 'superseded'"
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="actionLoadingId === adr.id"
              @click="openSupersedeModal(adr)"
            >
              Supersede
            </button>
            <button
              v-if="canPublish && adr.docStatus !== 'archived'"
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="actionLoadingId === adr.id"
              @click="archiveAdr(adr)"
            >
              Archive
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="showCreateModal = false">
      <div class="modal" style="width: 480px;">
        <div class="modal-header">
          <h2>New Architectural Decision</h2>
          <button class="modal-close" aria-label="Close" @click="showCreateModal = false">✕</button>
        </div>
        <form @submit.prevent="createAdr">
          <div class="modal-body">
            <div class="form-group">
              <label for="adrTitle">Title</label>
              <input
                id="adrTitle"
                v-model="createTitle"
                type="text"
                placeholder="e.g. Use OAuth 2.0 with PKCE"
                required
              />
            </div>
            <div class="form-group">
              <label for="adrCreateApp">App</label>
              <select id="adrCreateApp" v-model="createAppId" required>
                <option value="" disabled>Select app</option>
                <option v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create ADR</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal-overlay" :class="{ open: !!supersedeTarget }" @click.self="supersedeTarget = null">
      <div class="modal" style="width: 480px;">
        <div class="modal-header">
          <h2>Supersede ADR</h2>
          <button class="modal-close" aria-label="Close" @click="supersedeTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p class="desc">
            Mark <strong>{{ supersedeTarget?.displayLabel }}</strong> as superseded and link the replacement ADR.
          </p>
          <div class="form-group">
            <label for="replacementAdr">Replacement ADR</label>
            <select id="replacementAdr" v-model="replacementAdrId">
              <option value="">Select replacement…</option>
              <option v-for="adr in replacementOptions" :key="adr.id" :value="adr.id">
                {{ adr.displayLabel }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="supersedeTarget = null">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!replacementAdrId || actionLoadingId === supersedeTarget?.id"
            @click="confirmSupersede"
          >
            Supersede
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adr-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.adr-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.desc {
  margin: 0;
  color: var(--od-muted);
  font-size: 13px;
}

.row-between {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.adr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
}

.adr-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--od-border);
  border-radius: 8px;
  background: var(--od-surface-2, rgba(0, 0, 0, 0.02));
}

.adr-bulk-count {
  font-size: 13px;
  color: var(--od-muted);
  margin-right: 4px;
}

.check-col {
  width: 36px;
}

.row-check {
  width: 16px;
  height: 16px;
}

tr.is-selected {
  background: rgba(59, 130, 246, 0.06);
}

.adr-app-filter {
  margin: 0;
  min-width: 220px;
}

.adr-app-filter label,
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}

.adr-app-filter select,
.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius);
  background: var(--od-bg);
  font: inherit;
  font-size: 14px;
}

.adr-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  font-size: 13px;
  color: var(--od-muted);
}

.adr-summary-item strong {
  color: var(--od-fg);
}

.adr-empty {
  text-align: center;
  padding: 40px 20px;
  border: 1px dashed var(--od-border);
  border-radius: var(--od-radius-lg);
}

.adr-empty-title {
  margin: 0 0 6px;
  font-weight: 600;
}

.adr-empty-desc {
  margin: 0 0 16px;
  color: var(--od-muted);
  font-size: 13px;
}

.adr-link {
  color: var(--od-accent);
  text-decoration: none;
  font-weight: 500;
}

.adr-link:hover {
  text-decoration: underline;
}

.adr-binding-yes {
  color: oklch(45% 0.12 145);
  font-weight: 700;
}

.adr-binding-no {
  color: var(--od-muted);
}

.adr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  white-space: nowrap;
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.ds-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 500;
  color: var(--od-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--od-border);
}

.ds-table td {
  padding: 12px;
  border-bottom: 1px solid var(--od-border);
  vertical-align: middle;
}

.num {
  font-variant-numeric: tabular-nums;
  color: var(--od-muted);
  font-size: 13px;
}

.pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
}

.pill-green {
  background: oklch(95% 0.04 145);
  color: oklch(45% 0.12 145);
}

.pill-blue {
  background: oklch(95% 0.04 250);
  color: oklch(50% 0.12 250);
}

.pill-amber {
  background: oklch(95% 0.04 85);
  color: oklch(50% 0.1 85);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--od-radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  text-decoration: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: var(--od-accent);
  color: white;
  border-color: var(--od-accent);
}

.btn-secondary {
  border-color: var(--od-border);
  color: var(--od-fg);
}

.btn-ghost {
  color: var(--od-muted);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 16px;
  background: var(--od-border);
  border-radius: 4px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--od-fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.modal {
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-lg);
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--od-fg) 15%, transparent);
}

.modal-header,
.modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--od-border);
}

.modal-foot {
  border-bottom: none;
  border-top: 1px solid var(--od-border);
  justify-content: flex-end;
  gap: 8px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: var(--od-muted);
}

.modal-body {
  padding: 20px;
}
</style>
