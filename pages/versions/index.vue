<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { AppItem } from "~/composables/useApps";
import type { AppVersion } from "~/composables/useApps";

definePageMeta({
  auth: { required: true },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Versions");
});

const { apps, fetchApps } = useApps();
const { versions, isLoading, isCreating, isUpdating, isDeleting, fetchVersions, createVersion, updateVersion, deleteVersion } = useVersions();

const route = useRoute();
const router = useRouter();

// App selector
const selectedAppId = ref<string>("");

onMounted(async () => {
  await fetchApps();
  const appQuery = route.query.app as string;
  if (appQuery && apps.value.find((a) => a.id === appQuery)) {
    selectedAppId.value = appQuery;
  } else if (apps.value.length > 0) {
    selectedAppId.value = apps.value[0].id;
  }
  if (selectedAppId.value) {
    await fetchVersions(selectedAppId.value);
  }
});

watch(selectedAppId, async (id) => {
  if (id) {
    await fetchVersions(id);
    selectedVersions.value = [];
    activeDetailVersion.value = null;
  }
});

const selectedApp = computed(() => apps.value.find((a) => a.id === selectedAppId.value));

// Search
const searchQuery = ref("");

const filteredVersions = computed(() => {
  let result = [...versions.value];
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (v) =>
        v.version.toLowerCase().includes(q) ||
        (v.createdBy && v.createdBy.toLowerCase().includes(q)) ||
        (v.releaseNotes && v.releaseNotes.toLowerCase().includes(q)) ||
        (v.branch && v.branch.toLowerCase().includes(q))
    );
  }
  return result;
});

// Selection for compare
const selectedVersions = ref<string[]>([]);

function toggleVersionCheck(versionId: string, checked: boolean) {
  if (checked) {
    if (selectedVersions.value.length >= 2) {
      selectedVersions.value.shift();
    }
    selectedVersions.value.push(versionId);
  } else {
    selectedVersions.value = selectedVersions.value.filter((v) => v !== versionId);
  }
}

function clearSelection() {
  selectedVersions.value = [];
}

const compareBtnText = computed(() => {
  if (selectedVersions.value.length === 2) {
    const v1 = versions.value.find((v) => v.id === selectedVersions.value[0]);
    const v2 = versions.value.find((v) => v.id === selectedVersions.value[1]);
    return `Compare ${v1?.version ?? ""} vs ${v2?.version ?? ""}`;
  }
  return "Compare versions";
});

// Detail view
const activeDetailVersion = ref<AppVersion | null>(null);

function selectRow(version: AppVersion) {
  activeDetailVersion.value = version;
}

// Compare overlay
const showCompare = ref(false);
const compareOld = ref<AppVersion | null>(null);
const compareNew = ref<AppVersion | null>(null);

function openCompare() {
  if (selectedVersions.value.length !== 2) return;
  const sorted = [...selectedVersions.value];
  const v1 = versions.value.find((v) => v.id === sorted[0]) || null;
  const v2 = versions.value.find((v) => v.id === sorted[1]) || null;
  // Order by createdAt: older first
  const d1 = v1?.createdAt ? new Date(v1.createdAt).getTime() : 0;
  const d2 = v2?.createdAt ? new Date(v2.createdAt).getTime() : 0;
  compareOld.value = d1 <= d2 ? v1 : v2;
  compareNew.value = d1 <= d2 ? v2 : v1;
  showCompare.value = true;
}

function closeCompare() {
  showCompare.value = false;
}

// New Version Modal
const showNewVersionModal = ref(false);
const newVersionForm = reactive({
  version: "",
  releaseDate: "",
  status: "draft",
  releaseNotes: "",
  branch: "",
  tags: "",
  commitHash: "",
  approver: "",
  ciStatus: "unknown",
});
const newVersionError = ref(false);

function openNewVersionModal() {
  showNewVersionModal.value = true;
  newVersionError.value = false;
  newVersionForm.version = "";
  newVersionForm.releaseDate = new Date().toISOString().split("T")[0];
  newVersionForm.status = "draft";
  newVersionForm.releaseNotes = "";
  newVersionForm.branch = "";
  newVersionForm.tags = "";
  newVersionForm.commitHash = "";
  newVersionForm.approver = "";
  newVersionForm.ciStatus = "unknown";
  nextTick(() => {
    const el = document.getElementById("versionNumber");
    if (el) el.focus();
  });
}

function closeNewVersionModal() {
  showNewVersionModal.value = false;
  newVersionError.value = false;
}

async function submitNewVersion() {
  if (!newVersionForm.version.trim()) {
    newVersionError.value = true;
    return;
  }
  newVersionError.value = false;
  if (!selectedAppId.value || isCreating.value) return;
  await createVersion(selectedAppId.value, {
    version: newVersionForm.version.trim(),
    status: newVersionForm.status,
    releaseDate: newVersionForm.releaseDate || undefined,
    releaseNotes: newVersionForm.releaseNotes || undefined,
    branch: newVersionForm.branch || undefined,
    tags: newVersionForm.tags || undefined,
    commitHash: newVersionForm.commitHash || undefined,
    approver: newVersionForm.approver || undefined,
    ciStatus: newVersionForm.ciStatus,
  });
  closeNewVersionModal();
}

// Edit Version Modal
const showEditVersionModal = ref(false);
const editingVersion = ref<AppVersion | null>(null);
const editVersionForm = reactive({
  version: "",
  status: "draft",
  releaseDate: "",
  releaseNotes: "",
  branch: "",
  tags: "",
  commitHash: "",
  approver: "",
  ciStatus: "unknown",
});
const editVersionError = ref(false);

function openEditVersionModal(version: AppVersion) {
  editingVersion.value = version;
  editVersionForm.version = version.version;
  editVersionForm.status = version.status;
  editVersionForm.releaseDate = version.releaseDate ? version.releaseDate.split("T")[0] : "";
  editVersionForm.releaseNotes = version.releaseNotes || "";
  editVersionForm.branch = version.branch || "";
  editVersionForm.tags = version.tags || "";
  editVersionForm.commitHash = version.commitHash || "";
  editVersionForm.approver = version.approver || "";
  editVersionForm.ciStatus = version.ciStatus;
  editVersionError.value = false;
  showEditVersionModal.value = true;
}

function closeEditVersionModal() {
  showEditVersionModal.value = false;
  editingVersion.value = null;
}

async function submitEditVersion() {
  if (!editVersionForm.version.trim()) {
    editVersionError.value = true;
    return;
  }
  editVersionError.value = false;
  if (!editingVersion.value || !selectedAppId.value) return;
  await updateVersion(selectedAppId.value, editingVersion.value.id, {
    version: editVersionForm.version.trim(),
    status: editVersionForm.status,
    releaseDate: editVersionForm.releaseDate || undefined,
    releaseNotes: editVersionForm.releaseNotes || undefined,
    branch: editVersionForm.branch || undefined,
    tags: editVersionForm.tags || undefined,
    commitHash: editVersionForm.commitHash || undefined,
    approver: editVersionForm.approver || undefined,
    ciStatus: editVersionForm.ciStatus,
  });
  closeEditVersionModal();
}

// Delete confirmation
const versionToDelete = ref<AppVersion | null>(null);

function confirmDeleteVersion(version: AppVersion) {
  versionToDelete.value = version;
}

async function doDeleteVersion() {
  if (!versionToDelete.value || !selectedAppId.value) return;
  await deleteVersion(selectedAppId.value, versionToDelete.value.id);
  versionToDelete.value = null;
}

// Helpers
function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusClass: Record<string, string> = {
  published: "pill-green",
  draft: "pill-blue",
  rc: "pill-amber",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  rc: "RC",
  archived: "Archived",
};

const ciStatusClass: Record<string, string> = {
  passed: "pill-green",
  failed: "pill-red",
  pending: "pill-amber",
  unknown: "pill-muted",
};

const ciStatusLabel: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  pending: "Pending",
  unknown: "—",
};

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeCompare();
    closeNewVersionModal();
    closeEditVersionModal();
    versionToDelete.value = null;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="versions-page">
    <!-- Topbar -->
    <div class="topbar" style="margin-bottom: 16px;">
      <h1>Versions</h1>
      <div class="flex-gap-md">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search versions…"
          aria-label="Search versions"
        />
        <select v-model="selectedAppId" class="select">
          <option v-for="app in apps" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>
        <button type="button" class="btn btn-primary" @click="openNewVersionModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Version
        </button>
      </div>
    </div>

    <!-- App info -->
    <div class="row-between" style="margin-bottom: 16px;">
      <div>
        <h2 class="section-title">
          {{ selectedApp?.name ?? "—" }} · {{ versions.length }} version{{ versions.length === 1 ? "" : "s" }}
        </h2>
        <p class="text-muted-sm" style="margin: 4px 0 0;">
          Current:
          <span v-if="selectedApp?.latestVersion" class="num pill pill-blue">v{{ selectedApp.latestVersion.version }}</span>
          <span v-else class="text-muted-sm">No version</span>
          <span v-if="selectedApp?.latestVersion?.createdAt">
            · Published {{ formatDate(selectedApp.latestVersion.createdAt) }}
          </span>
        </p>
      </div>
      <div class="flex-gap-sm">
        <button
          class="btn btn-secondary"
          :disabled="selectedVersions.length !== 2"
          @click="openCompare"
        >
          {{ compareBtnText }}
        </button>
        <button class="btn btn-ghost" @click="clearSelection">Archive</button>
      </div>
    </div>

    <!-- Selection bar -->
    <div class="selection-bar" :class="{ active: selectedVersions.length > 0 }">
      <span>
        <span class="num">{{ selectedVersions.length }}</span> version{{ selectedVersions.length === 1 ? "" : "s" }} selected
      </span>
      <span class="text-muted-sm">Select 2 to compare</span>
      <button type="button" class="btn btn-ghost btn-sm" style="margin-left: auto;" @click="clearSelection">
        Clear
      </button>
    </div>

    <!-- Versions table -->
    <div class="card table-card">
      <table class="ds-table">
        <thead>
          <tr>
            <th class="check-col"></th>
            <th>Version</th>
            <th>Date</th>
            <th>Author</th>
            <th>Status</th>
            <th>CI</th>
            <th>Release</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="v in filteredVersions"
            :key="v.id"
            :class="{ selected: selectedVersions.includes(v.id), 'cursor-pointer': true }"
            @click="selectRow(v)"
          >
            <td class="check-col" @click.stop>
              <input
                type="checkbox"
                :checked="selectedVersions.includes(v.id)"
                @change="toggleVersionCheck(v.id, ($event.target as HTMLInputElement).checked)"
                :aria-label="`Select version ${v.version}`"
              />
            </td>
            <td class="num version-num">v{{ v.version }}</td>
            <td class="num">{{ formatDate(v.releaseDate || v.createdAt) }}</td>
            <td>{{ v.createdBy || "—" }}</td>
            <td>
              <span class="pill" :class="statusClass[v.status] || 'pill-blue'">
                {{ statusLabel[v.status] || v.status }}
              </span>
            </td>
            <td>
              <span class="pill" :class="ciStatusClass[v.ciStatus] || 'pill-muted'">
                {{ ciStatusLabel[v.ciStatus] || v.ciStatus }}
              </span>
            </td>
            <td>
              <NuxtLink v-if="v.releaseId && v.releasePublished" :to="`/releases/${v.releaseId}`" class="btn btn-ghost btn-sm" @click.stop>
                View
              </NuxtLink>
              <span v-else-if="v.releaseId" class="text-muted-sm">Draft</span>
              <span v-else class="text-muted-sm">—</span>
            </td>
            <td @click.stop>
              <div class="flex-gap-sm">
                <button class="btn btn-ghost btn-sm" title="Edit version" @click="openEditVersionModal(v)">
                  <IconsPencil size="14" />
                </button>
                <button class="btn btn-ghost btn-sm" title="Delete version" @click="confirmDeleteVersion(v)">
                  <IconsTrash size="14" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredVersions.length === 0 && !isLoading">
            <td colspan="8" class="empty-cell">No versions found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Version detail panel -->
    <div v-if="activeDetailVersion" class="version-detail">
      <div class="card detail-card">
        <h3>Release Notes · v{{ activeDetailVersion.version }}</h3>
        <p v-if="activeDetailVersion.releaseNotes" style="line-height: 1.6;">
          {{ activeDetailVersion.releaseNotes }}
        </p>
        <p v-else class="text-muted-sm">No release notes provided.</p>
        <div v-if="activeDetailVersion.commitHash" style="margin-top: 16px;">
          <span class="num">Commit {{ activeDetailVersion.commitHash }}</span>
        </div>
      </div>
      <div class="card detail-card">
        <h3>Metadata</h3>
        <p><strong>Branch:</strong> <span class="num">{{ activeDetailVersion.branch || "—" }}</span></p>
        <p><strong>Tags:</strong> <span class="num">{{ activeDetailVersion.tags || "—" }}</span></p>
        <p>
          <strong>CI/CD:</strong>
          <span class="pill" :class="ciStatusClass[activeDetailVersion.ciStatus] || 'pill-muted'">
            {{ ciStatusLabel[activeDetailVersion.ciStatus] || activeDetailVersion.ciStatus }}
          </span>
        </p>
        <p><strong>Approver:</strong> {{ activeDetailVersion.approver || "—" }}</p>
        <p style="margin-top: 12px;">
          <button type="button" class="btn btn-secondary" style="width: 100%;">Download Release Bundle</button>
        </p>
      </div>
    </div>

    <!-- Compare overlay -->
    <div class="compare-overlay" :class="{ active: showCompare }" @click.self="closeCompare">
      <div class="compare-panel">
        <div class="compare-header">
          <h2>Compare versions</h2>
          <button type="button" class="close-btn" aria-label="Close compare overlay" @click="closeCompare">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="compare-body">
          <div class="diff-stat">
            <div class="diff-stat-item">
              <span class="num added">+4</span>
              <span class="label">Added</span>
            </div>
            <div class="diff-stat-item">
              <span class="num removed">−2</span>
              <span class="label">Removed</span>
            </div>
            <div class="diff-stat-item">
              <span class="num changed">3</span>
              <span class="label">Changed</span>
            </div>
            <div class="diff-stat-item">
              <span class="num">7 files</span>
              <span class="label">Files</span>
            </div>
            <div class="diff-stat-item">
              <span class="num">+284 −67</span>
              <span class="label">Lines</span>
            </div>
          </div>
          <div class="compare-grid">
            <div class="compare-col">
              <h3>v{{ compareOld?.version }} · {{ formatDate(compareOld?.releaseDate || compareOld?.createdAt) }}</h3>
              <ul class="diff-list">
                <li v-if="compareOld?.releaseNotes" class="changed">
                  <svg class="diff-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <span>{{ compareOld.releaseNotes }}</span>
                </li>
                <li v-else>No release notes</li>
              </ul>
            </div>
            <div class="compare-col">
              <h3>v{{ compareNew?.version }} · {{ formatDate(compareNew?.releaseDate || compareNew?.createdAt) }}</h3>
              <ul class="diff-list">
                <li v-if="compareNew?.releaseNotes" class="added">
                  <svg class="diff-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span>{{ compareNew.releaseNotes }}</span>
                </li>
                <li v-else>No release notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Version Modal -->
    <div class="modal-overlay" :class="{ open: showNewVersionModal }" @click.self="closeNewVersionModal">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>Create New Version</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeNewVersionModal">✕</button>
        </div>
        <form novalidate @submit.prevent="submitNewVersion">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label for="versionNumber">Version Number</label>
                <input
                  id="versionNumber"
                  v-model="newVersionForm.version"
                  type="text"
                  placeholder="e.g. v2.5.0"
                  required
                  :class="{ 'input-error': newVersionError }"
                  aria-describedby="versionNumberError"
                  @input="newVersionError = false"
                />
                <span id="versionNumberError" class="error-msg" :class="{ show: newVersionError }">
                  Version number is required
                </span>
              </div>
              <div class="form-group">
                <label for="releaseDate">Release Date</label>
                <input id="releaseDate" v-model="newVersionForm.releaseDate" type="date" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="versionStatus">Status</label>
                <select id="versionStatus" v-model="newVersionForm.status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="rc">RC</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div class="form-group">
                <label for="versionCiStatus">CI Status</label>
                <select id="versionCiStatus" v-model="newVersionForm.ciStatus">
                  <option value="unknown">Unknown</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="versionBranch">Git Branch / CI Ref <span class="opt">(optional)</span></label>
              <input id="versionBranch" v-model="newVersionForm.branch" type="text" placeholder="e.g. release/2.5.0" />
            </div>
            <div class="form-group">
              <label for="versionTags">Tags <span class="opt">(optional)</span></label>
              <input id="versionTags" v-model="newVersionForm.tags" type="text" placeholder="e.g. breaking-change, security-fix, feature" />
            </div>
            <div class="form-group">
              <label for="versionCommit">Commit Hash <span class="opt">(optional)</span></label>
              <input id="versionCommit" v-model="newVersionForm.commitHash" type="text" placeholder="e.g. a7f3c2d" />
            </div>
            <div class="form-group">
              <label for="versionApprover">Approver <span class="opt">(optional)</span></label>
              <input id="versionApprover" v-model="newVersionForm.approver" type="text" placeholder="e.g. Sarah Chen" />
            </div>
            <div class="form-group">
              <label for="releaseNotes">Release Notes <span class="opt">(optional)</span></label>
              <textarea id="releaseNotes" v-model="newVersionForm.releaseNotes" placeholder="Describe what changed in this version...
- Added: ...
- Fixed: ...
- Changed: ...
- Deprecated: ..." />
            </div>
          </div>
          <div class="form-footer">
            <button type="button" class="btn btn-secondary" @click="closeNewVersionModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create Version</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Version Modal -->
    <div class="modal-overlay" :class="{ open: showEditVersionModal }" @click.self="closeEditVersionModal">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>Edit Version</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeEditVersionModal">✕</button>
        </div>
        <form novalidate @submit.prevent="submitEditVersion">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label for="editVersionNumber">Version Number</label>
                <input
                  id="editVersionNumber"
                  v-model="editVersionForm.version"
                  type="text"
                  required
                  :class="{ 'input-error': editVersionError }"
                  @input="editVersionError = false"
                />
                <span class="error-msg" :class="{ show: editVersionError }">Version number is required</span>
              </div>
              <div class="form-group">
                <label for="editReleaseDate">Release Date</label>
                <input id="editReleaseDate" v-model="editVersionForm.releaseDate" type="date" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="editVersionStatus">Status</label>
                <select id="editVersionStatus" v-model="editVersionForm.status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="rc">RC</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div class="form-group">
                <label for="editVersionCiStatus">CI Status</label>
                <select id="editVersionCiStatus" v-model="editVersionForm.ciStatus">
                  <option value="unknown">Unknown</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="editVersionBranch">Git Branch / CI Ref <span class="opt">(optional)</span></label>
              <input id="editVersionBranch" v-model="editVersionForm.branch" type="text" />
            </div>
            <div class="form-group">
              <label for="editVersionTags">Tags <span class="opt">(optional)</span></label>
              <input id="editVersionTags" v-model="editVersionForm.tags" type="text" />
            </div>
            <div class="form-group">
              <label for="editVersionCommit">Commit Hash <span class="opt">(optional)</span></label>
              <input id="editVersionCommit" v-model="editVersionForm.commitHash" type="text" />
            </div>
            <div class="form-group">
              <label for="editVersionApprover">Approver <span class="opt">(optional)</span></label>
              <input id="editVersionApprover" v-model="editVersionForm.approver" type="text" />
            </div>
            <div class="form-group">
              <label for="editReleaseNotes">Release Notes <span class="opt">(optional)</span></label>
              <textarea id="editReleaseNotes" v-model="editVersionForm.releaseNotes" />
            </div>
          </div>
          <div class="form-footer">
            <button type="button" class="btn btn-secondary" @click="closeEditVersionModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="isUpdating">
              <span v-if="isUpdating">Saving…</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!versionToDelete }" @click.self="versionToDelete = null">
      <div class="modal-panel" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Delete Version</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="versionToDelete = null">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to delete <strong>v{{ versionToDelete?.version }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="versionToDelete = null">Cancel</button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="doDeleteVersion">
            <span v-if="isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.versions-page {
  /* inherits global tokens */
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
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
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
.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}
.pill-red {
  background: color-mix(in oklch, oklch(55% 0.2 25) 12%, transparent);
  color: oklch(50% 0.16 25);
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
.ds-table .check-col {
  width: 40px;
  padding-right: 0;
}
.ds-table .version-num {
  font-weight: 600;
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
.ds-table tbody tr.selected {
  background: var(--accent-soft);
}
.ds-table tbody tr.selected:hover {
  background: color-mix(in oklch, var(--accent) 18%, transparent);
}
.ds-table tbody tr.cursor-pointer {
  cursor: pointer;
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.empty-cell {
  text-align: center;
  color: var(--muted);
  padding: 32px;
}

.selection-bar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in oklch, var(--accent) 20%, transparent);
  border-radius: var(--radius);
  margin-bottom: 16px;
  font-size: 14px;
}
.selection-bar.active {
  display: flex;
}
.selection-bar .num {
  font-weight: 600;
  color: var(--accent);
}

.version-detail {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  margin-top: 32px;
}
@media (max-width: 960px) {
  .version-detail {
    grid-template-columns: 1fr;
  }
}
.detail-card h3 {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.detail-card p {
  margin: 0 0 8px;
  font-size: 14px;
}

/* Compare overlay */
.compare-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklch, var(--fg) 40%, transparent);
  z-index: 100;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.compare-overlay.active {
  display: flex;
}
.compare-panel {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  width: 100%;
  max-width: 1100px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px color-mix(in oklch, var(--fg) 12%, transparent);
}
.compare-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.compare-header h2 {
  font-size: 18px;
}
.compare-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 800px) {
  .compare-grid {
    grid-template-columns: 1fr;
  }
}
.compare-col h3 {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.diff-stat {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.diff-stat-item {
  text-align: center;
}
.diff-stat-item .num {
  font-size: 20px;
  font-weight: 600;
  display: block;
}
.diff-stat-item .label {
  font-size: 12px;
  color: var(--muted);
}
.diff-stat-item .added {
  color: oklch(50% 0.14 145);
}
.diff-stat-item .removed {
  color: oklch(50% 0.16 25);
}
.diff-stat-item .changed {
  color: oklch(55% 0.14 255);
}

.diff-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.diff-list li {
  padding: 10px 12px;
  border-radius: var(--radius);
  margin-bottom: 6px;
  font-size: 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.diff-list li.added {
  background: color-mix(in oklch, oklch(60% 0.18 145) 8%, transparent);
}
.diff-list li.removed {
  background: color-mix(in oklch, oklch(55% 0.2 25) 8%, transparent);
  text-decoration: line-through;
  opacity: 0.7;
}
.diff-list li.changed {
  background: color-mix(in oklch, oklch(60% 0.16 255) 8%, transparent);
}
.diff-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.close-btn {
  background: none;
  border: 1px solid transparent;
  padding: 4px;
  color: var(--muted);
  cursor: pointer;
  border-radius: var(--radius);
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.close-btn:hover {
  background: var(--fg-soft);
  color: var(--fg);
  border-color: var(--border);
}
.close-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
.form-group input[type="text"],
.form-group input[type="date"],
.form-group select,
.form-group textarea {
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
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.form-group textarea {
  min-height: 120px;
  resize: vertical;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }
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
  .select,
  .compare-overlay,
  .compare-panel,
  .close-btn {
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
  .version-detail {
    grid-template-columns: 1fr;
  }
}
</style>
