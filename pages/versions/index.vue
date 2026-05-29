<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { renderMarkdown } from "~/composables/useMarkdown";
import type { AppItem } from "~/composables/useApps";
import type { AppVersion } from "~/composables/useApps";
import type { ReleaseItem } from "~/composables/useReleases";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Versions");
});

const { apps, fetchApps } = useApps();
const { versions, isLoading, isCreating, isUpdating, isDeleting, fetchVersions, createVersion, updateVersion, deleteVersion } = useVersions();
const { fetchRelease } = useReleases();

const isArchiving = ref(false);

const route = useRoute();
const router = useRouter();

// App selector: shared across pages via store + localStorage
$page.hydrateSelection();
const selectedAppId = computed({
  get: () => $page.selectedAppId,
  set: (val: string) => $page.setSelectedAppId(val)
});

onMounted(async () => {
  await fetchApps();
  const appQuery = route.query.app as string;
  const persistedAppId = $page.selectedAppId;

  // Restore selection: URL param > persisted store > first app
  if (appQuery && apps.value.find((a) => a.id === appQuery)) {
    selectedAppId.value = appQuery;
  } else if (persistedAppId && apps.value.find((a) => a.id === persistedAppId)) {
    selectedAppId.value = persistedAppId;
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

const appOptions = computed(() =>
  apps.value.map((a) => ({ id: a.id, label: a.name }))
);

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
  // Sort by newest first (releaseDate desc, fallback to createdAt desc)
  result.sort((a, b) => {
    const dA = new Date(a.releaseDate || a.createdAt || 0).getTime();
    const dB = new Date(b.releaseDate || b.createdAt || 0).getTime();
    return dB - dA;
  });
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

// Bulk archive selected versions
async function archiveSelectedVersions() {
  if (!selectedAppId.value || selectedVersions.value.length === 0 || isArchiving.value) return;
  isArchiving.value = true;
  try {
    for (const versionId of selectedVersions.value) {
      await updateVersion(selectedAppId.value, versionId, { status: "archived" });
    }
    selectedVersions.value = [];
    await fetchVersions(selectedAppId.value);
  } finally {
    isArchiving.value = false;
  }
}

// Detail view
const activeDetailVersion = ref<AppVersion | null>(null);
const activeReleaseDetail = ref<ReleaseItem | null>(null);
const isLoadingReleaseDetail = ref(false);

function selectRow(version: AppVersion) {
  activeDetailVersion.value = version;
}

async function loadReleaseDetail(version: AppVersion | null) {
  activeReleaseDetail.value = null;
  if (!version) return;
  const normalRelease = version.releases?.find((r) => r.type === "normal");
  if (!normalRelease) return;
  isLoadingReleaseDetail.value = true;
  try {
    const release = await fetchRelease(normalRelease.id);
    activeReleaseDetail.value = release;
  } catch {
    activeReleaseDetail.value = null;
  } finally {
    isLoadingReleaseDetail.value = false;
  }
}

watch(activeDetailVersion, (v) => {
  loadReleaseDetail(v);
}, { immediate: true });

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
  const newVersion = await createVersion(selectedAppId.value, {
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
  // Navigate to changelog editor with the new version pre-selected
  if (newVersion?.id) {
    await navigateTo(`/changelogs?app=${selectedAppId.value}&versionId=${newVersion.id}`);
  }
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

function countCategories(categories: ReleaseItem["categories"]) {
  return {
    added: categories?.added || [],
    fixed: categories?.fixed || [],
    changed: categories?.changed || [],
    deprecated: categories?.deprecated || [],
    security: categories?.security || [],
  };
}

const categoryConfig: Record<string, { label: string; tagClass: string }> = {
  fixed: { label: "Fixed", tagClass: "rl-tag-fixed" },
  added: { label: "Added", tagClass: "rl-tag-added" },
  changed: { label: "Changed", tagClass: "rl-tag-changed" },
  deprecated: { label: "Deprecated", tagClass: "rl-tag-deprecated" },
  security: { label: "Security", tagClass: "rl-tag-security" },
};

// Parse markdown changelog text into categories
function parseChangelogMarkdown(text: string | null): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    added: [],
    fixed: [],
    changed: [],
    deprecated: [],
    security: [],
  };
  if (!text) return categories;

  const lines = text.split(/\n/);
  let currentCategory = "";

  for (const line of lines) {
    const trimmed = line.trim();
    // Match headers like ## Added, ## Fixed, ### Added, etc.
    const headerMatch = trimmed.match(/^#{2,3}\s*(Added|Fixed|Changed|Deprecated|Security)/i);
    if (headerMatch) {
      currentCategory = headerMatch[1].toLowerCase();
      continue;
    }
    // Match list items (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = trimmed.slice(2).trim();
      if (item && currentCategory && categories[currentCategory]) {
        categories[currentCategory].push(item);
      }
    }
  }

  return categories;
}

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
    <header class="topbar">
      <h1>Versions</h1>
      <div class="flex-gap-md">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search versions…"
          aria-label="Search versions"
        />
        <GeneralSearchableDropdown
          v-model="selectedAppId"
          :options="appOptions"
          placeholder="Select app…"
          search-placeholder="Search apps…"
        />
        <button type="button" class="btn btn-primary" @click="openNewVersionModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Version
        </button>
      </div>
    </header>

    <!-- App info -->
    <div class="row-between" style="margin-bottom: 16px;">
      <div>
        <template v-if="isLoading">
          <h2 class="section-title">
            <span class="loading-spinner" /> Loading…
          </h2>
          <p class="text-muted-sm" style="margin: 4px 0 0;">Fetching versions</p>
        </template>
        <template v-else>
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
        </template>
      </div>
      <div class="flex-gap-sm">
        <button
          class="btn btn-secondary"
          :disabled="selectedVersions.length !== 2 || isArchiving"
          @click="openCompare"
        >
          {{ compareBtnText }}
        </button>
        <button
          class="btn btn-ghost"
          :disabled="selectedVersions.length === 0 || isArchiving"
          @click="archiveSelectedVersions"
        >
          <span v-if="isArchiving">Archiving…</span>
          <span v-else>Archive</span>
        </button>
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
            <th>Release</th>
            <th>Changelog</th>
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
              <div v-if="v.releases && v.releases.length > 0" class="release-stack">
                <NuxtLink
                  v-for="r in v.releases"
                  :key="r.id"
                  :to="`/releases/${r.id}`"
                  class="release-pill-link"
                  @click.stop
                >
                  <span class="pill" :class="r.type === 'article' ? 'pill-purple' : 'pill-muted'">
                    {{ r.type === 'article' ? 'Article' : 'Normal' }}
                  </span>
                </NuxtLink>
              </div>
              <span v-else class="text-muted-sm">—</span>
            </td>
            <td>
              <NuxtLink :to="`/changelogs?versionId=${v.id}`" class="btn btn-ghost btn-sm" @click.stop>
                Edit
              </NuxtLink>
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
          <tr v-if="isLoading">
            <td colspan="9" class="empty-cell">
              <span class="loading-spinner" /> Loading versions…
            </td>
          </tr>
          <tr v-else-if="filteredVersions.length === 0">
            <td colspan="9" class="empty-cell">No versions found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Version detail panel -->
    <div v-if="activeDetailVersion" class="version-detail">
      <div class="card detail-card">
        <div class="detail-card-header">
          <h3>Changelog · v{{ activeDetailVersion.version }}</h3>
          <NuxtLink :to="`/changelogs?versionId=${activeDetailVersion.id}`" class="btn btn-ghost btn-sm">
            Edit
          </NuxtLink>
        </div>
        <div v-if="isLoadingReleaseDetail" class="text-muted-sm">
          <span class="loading-spinner" /> Loading changelog…
        </div>
        <template v-else-if="activeReleaseDetail?.categories">
          <div
            v-for="[key, items] in Object.entries(countCategories(activeReleaseDetail.categories)).filter(([, v]) => v.length > 0)"
            :key="key"
            class="rl-cat-group"
          >
            <span class="rl-cat-badge" :class="categoryConfig[key]?.tagClass || 'rl-tag-muted'">
              {{ categoryConfig[key]?.label || key }}
            </span>
            <ul class="rl-cat-list list-disc">
              <li v-for="item in items" :key="item">{{ item }}</li>
            </ul>
          </div>
        </template>
        <p v-else-if="activeReleaseDetail?.summary" style="line-height: 1.6;" v-html="renderMarkdown(activeReleaseDetail.summary)" />
        <p v-else class="text-muted-sm">No changelog available.</p>
        <div v-if="activeDetailVersion.commitHash" style="margin-top: 16px;">
          <span class="num">Commit {{ activeDetailVersion.commitHash }}</span>
        </div>
      </div>
    </div>

    <!-- Compare overlay -->
    <div class="compare-overlay" :class="{ active: showCompare }" role="dialog" aria-modal="true" aria-label="Compare versions" @click.self="closeCompare">
      <div class="compare-panel">
        <div class="compare-header">
          <div class="compare-header-title">
            <h2>Compare versions</h2>
            <p class="compare-subtitle">v{{ compareOld?.version }} vs v{{ compareNew?.version }}</p>
          </div>
          <button type="button" class="close-btn" aria-label="Close compare" @click="closeCompare">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="compare-body">
          <div class="compare-grid">
            <div class="compare-col">
              <div class="compare-col-header">
                <div class="compare-col-meta">
                  <h3>v{{ compareOld?.version }}</h3>
                  <span class="compare-col-date">{{ formatDate(compareOld?.releaseDate || compareOld?.createdAt) }}</span>
                </div>
                <span class="pill" :class="statusClass[compareOld?.status || 'draft']">{{ statusLabel[compareOld?.status || 'draft'] }}</span>
              </div>
              <div class="compare-content">
                <template v-if="compareOld?.releaseNotes">
                  <div
                    v-for="[key, items] in Object.entries(parseChangelogMarkdown(compareOld.releaseNotes)).filter(([, v]) => v.length > 0)"
                    :key="key"
                    class="compare-cat-group"
                  >
                    <div class="compare-cat-header">
                      <span class="compare-cat-badge" :class="categoryConfig[key]?.tagClass || 'rl-tag-muted'">
                        {{ categoryConfig[key]?.label || key }}
                      </span>
                      <span class="compare-cat-count">{{ items.length }} item{{ items.length === 1 ? '' : 's' }}</span>
                    </div>
                    <ul class="compare-cat-list">
                      <li v-for="item in items" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </template>
                <div v-else class="compare-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <p>No changelog for this version</p>
                </div>
              </div>
            </div>
            <div class="compare-divider" aria-hidden="true" />
            <div class="compare-col">
              <div class="compare-col-header">
                <div class="compare-col-meta">
                  <h3>v{{ compareNew?.version }}</h3>
                  <span class="compare-col-date">{{ formatDate(compareNew?.releaseDate || compareNew?.createdAt) }}</span>
                </div>
                <span class="pill" :class="statusClass[compareNew?.status || 'draft']">{{ statusLabel[compareNew?.status || 'draft'] }}</span>
              </div>
              <div class="compare-content">
                <template v-if="compareNew?.releaseNotes">
                  <div
                    v-for="[key, items] in Object.entries(parseChangelogMarkdown(compareNew.releaseNotes)).filter(([, v]) => v.length > 0)"
                    :key="key"
                    class="compare-cat-group"
                  >
                    <div class="compare-cat-header">
                      <span class="compare-cat-badge" :class="categoryConfig[key]?.tagClass || 'rl-tag-muted'">
                        {{ categoryConfig[key]?.label || key }}
                      </span>
                      <span class="compare-cat-count">{{ items.length }} item{{ items.length === 1 ? '' : 's' }}</span>
                    </div>
                    <ul class="compare-cat-list">
                      <li v-for="item in items" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </template>
                <div v-else class="compare-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <p>No changelog for this version</p>
                </div>
              </div>
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
            <details class="technical-details">
              <summary>Technical details</summary>
              <div class="form-row">
                <div class="form-group">
                  <label for="versionCiStatus">CI Status</label>
                  <select id="versionCiStatus" v-model="newVersionForm.ciStatus">
                    <option value="unknown">Unknown</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="versionCommit">Commit Hash <span class="opt">(optional)</span></label>
                  <input id="versionCommit" v-model="newVersionForm.commitHash" type="text" placeholder="e.g. a7f3c2d" />
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
            </details>
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
              <label for="editVersionApprover">Approver <span class="opt">(optional)</span></label>
              <input id="editVersionApprover" v-model="editVersionForm.approver" type="text" />
            </div>
            <div class="form-group">
              <label for="editReleaseNotes">Release Notes <span class="opt">(optional)</span></label>
              <textarea id="editReleaseNotes" v-model="editVersionForm.releaseNotes" />
            </div>
            <details class="technical-details">
              <summary>Technical details</summary>
              <div class="form-row">
                <div class="form-group">
                  <label for="editVersionCiStatus">CI Status</label>
                  <select id="editVersionCiStatus" v-model="editVersionForm.ciStatus">
                    <option value="unknown">Unknown</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="editVersionCommit">Commit Hash <span class="opt">(optional)</span></label>
                  <input id="editVersionCommit" v-model="editVersionForm.commitHash" type="text" />
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
            </details>
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
.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.18 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}

.release-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.release-pill-link {
  text-decoration: none;
  width: fit-content;
  display: block;
}
.release-pill-link .pill {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.release-pill-link:hover .pill {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px oklch(0% 0 0 / 0.08);
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.compare-overlay.active {
  opacity: 1;
  pointer-events: auto;
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
  transform: translateY(12px) scale(0.98);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.compare-overlay.active .compare-panel {
  transform: translateY(0) scale(1);
}
.compare-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.compare-header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.compare-header h2 {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
}
.compare-subtitle {
  font-size: 14px;
  color: var(--muted);
  margin: 0;
}
.compare-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  position: relative;
}
@media (max-width: 800px) {
  .compare-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
.compare-divider {
  width: 1px;
  background: var(--border);
  align-self: stretch;
  justify-self: center;
}
@media (max-width: 800px) {
  .compare-divider {
    display: none;
  }
}
.compare-col-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.compare-col-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.compare-col-header h3 {
  font-size: 16px;
  color: var(--fg);
  margin: 0;
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.compare-col-date {
  font-size: 13px;
  color: var(--muted);
}

.compare-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.compare-cat-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.compare-cat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.compare-cat-count {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.compare-cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-cat-list li {
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 14px;
  line-height: 1.5;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--fg);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.compare-cat-list li:hover {
  background: var(--surface);
  border-color: color-mix(in oklch, var(--muted) 50%, var(--border));
}

.compare-cat-group .rl-tag-added + .compare-cat-list li {
  background: color-mix(in oklch, oklch(60% 0.18 145) 6%, var(--bg));
  border-color: color-mix(in oklch, oklch(50% 0.14 145) 30%, var(--border));
}
.compare-cat-group .rl-tag-fixed + .compare-cat-list li {
  background: color-mix(in oklch, oklch(60% 0.16 255) 6%, var(--bg));
  border-color: color-mix(in oklch, oklch(55% 0.14 255) 30%, var(--border));
}
.compare-cat-group .rl-tag-changed + .compare-cat-list li {
  background: color-mix(in oklch, oklch(75% 0.14 85) 6%, var(--bg));
  border-color: color-mix(in oklch, oklch(60% 0.12 85) 30%, var(--border));
}
.compare-cat-group .rl-tag-deprecated + .compare-cat-list li {
  background: color-mix(in oklch, oklch(60% 0.18 300) 6%, var(--bg));
  border-color: color-mix(in oklch, oklch(55% 0.14 300) 30%, var(--border));
}
.compare-cat-group .rl-tag-security + .compare-cat-list li {
  background: color-mix(in oklch, oklch(55% 0.2 25) 6%, var(--bg));
  border-color: color-mix(in oklch, oklch(50% 0.16 25) 30%, var(--border));
}

.compare-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--muted);
  text-align: center;
}
.compare-empty svg {
  opacity: 0.5;
}
.compare-empty p {
  margin: 0;
  font-size: 14px;
}

.close-btn {
  background: none;
  border: 1px solid transparent;
  padding: 4px;
  color: var(--muted);
  cursor: pointer;
  border-radius: var(--radius);
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
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
.close-btn:active {
  transform: scale(0.96);
  transition-duration: 0.05s;
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
.technical-details {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.technical-details summary {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.technical-details summary::before {
  content: "▸";
  font-size: 11px;
  display: inline-block;
  transition: transform 0.15s ease;
}
.technical-details[open] summary::before {
  transform: rotate(90deg);
}
.technical-details summary:hover {
  color: var(--text);
}
.technical-details > .form-group,
.technical-details > .form-row {
  margin-top: 12px;
  animation: detailsSlideDown 0.2s ease;
}
@keyframes detailsSlideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.error-banner {
  background: color-mix(in oklch, oklch(55% 0.18 25) 8%, transparent);
  color: oklch(50% 0.16 25);
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  margin-bottom: 16px;
  border: 1px solid color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent);
}
.help-text {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
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
  .compare-overlay {
    padding: 16px;
  }
  .compare-body {
    padding: 16px;
  }
  .compare-header {
    padding: 16px;
  }
}

/* Changelog category display */
.rl-cat-group {
  margin-bottom: 16px;
}
.rl-cat-group:last-child {
  margin-bottom: 0;
}
.rl-cat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}
.rl-tag-added {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}
.rl-tag-fixed {
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}
.rl-tag-changed {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
}
.rl-tag-deprecated {
  background: color-mix(in oklch, oklch(60% 0.18 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.rl-tag-security {
  background: color-mix(in oklch, oklch(55% 0.2 25) 12%, transparent);
  color: oklch(50% 0.16 25);
}
.rl-tag-muted {
  background: var(--fg-soft);
  color: var(--muted);
}
.rl-cat-list {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
}
.rl-cat-list li {
  margin-bottom: 4px;
}

/* Detail card header with edit button */
.detail-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.detail-card-header h3 {
  margin: 0;
}
</style>
