<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { DocItem } from "~/composables/useDocs";
import ChevronDown from "~/components/icons/ChevronDown/index.vue";
import {
  docListPrimaryLabel,
  docListSecondaryLabel,
  isAdrDoc,
  isFeatureCatalogDoc,
  isWikiDoc,
  DOC_LIST_VIEW_OPTIONS,
  sectionCollapseKey,
  shouldCollapseKnowledgeSection,
  type DocListGroup,
  type DocListSection,
  type DocListView,
} from "~/utils/doc-display";
import { slugify } from "~/utils/nav-client";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Docs");
});

const route = useRoute();
const router = useRouter();
const { can, canAny } = usePermissions();
const { search, createDoc, deleteDoc, bulkUpdateStatus } = useDocs();

const canWriteDocs = computed(() => can("docs:write"));
const canWriteAdrs = computed(() => can("adrs:write"));
const canReadDraftAdrs = computed(() => can("adrs:read"));
const canPublishDocs = computed(() => can("docs:publish"));
const canRunDocGeneration = computed(() => can("doc_generation:run"));
const canManageDocSites = computed(() => can("doc_sites:write"));
const canBulkUpdateDocs = computed(() => canAny("docs:write", "docs:publish"));
const { apps, fetchApps } = useApps();
const { docSites, fetchDocSites } = useDocSites();
const { preferInternalWiki, fetchMcpConfig } = useMcpConfig();

const appFilter = ref((route.query.app as string) || "");
const siteFilter = ref((route.query.siteId as string) || "");
const statusFilter = ref("");
const docView = ref<DocListView>("product");

const {
  summary,
  isSummaryLoading,
  appLoads,
  isKnowledgeLoading,
  isKnowledgeLoadingMore,
  knowledgeTotal,
  fetchSummary,
  resetAppLoads,
  resetKnowledge,
  ensureAppLoaded,
  loadMoreAppDocs,
  fetchKnowledgePage,
  buildAccordionGroups,
  appDocCount,
  unboundDocCount,
  removeDocFromCaches,
  knowledgeCatalogDocs,
} = useDocsPageList();

const listFilters = computed(() => ({
  search: search.value,
  appId: appFilter.value,
  siteId: siteFilter.value,
  status: statusFilter.value,
}));

const embeddingScheduleAppId = computed(() => appFilter.value || "");
const {
  settings: embeddingScheduleSettings,
  isLoading: isLoadingEmbeddingSchedule,
  isSaving: isSavingEmbeddingSchedule,
  isRunning: isRunningEmbeddingSchedule,
  fetchSchedule: fetchEmbeddingSchedule,
  toggleSchedule: toggleEmbeddingSchedule,
  runNow: runEmbeddingIndexNow,
} = useDocEmbeddingSchedule(embeddingScheduleAppId);

const embeddingScheduleIntervalLabel = computed(() => {
  const interval = embeddingScheduleSettings.value?.workspaceSchedule.interval;
  const labels: Record<string, string> = {
    hourly: "hourly",
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
  };
  return labels[interval ?? "daily"] ?? "daily";
});

const embeddingScheduleActive = computed(() => {
  return (
    !!embeddingScheduleSettings.value?.scheduleEnabled &&
    !!embeddingScheduleSettings.value?.workspaceSchedule.enabled
  );
});

const embeddingScheduleHint = computed(() => {
  if (!appFilter.value) return "";
  if (!embeddingScheduleSettings.value) return "";
  if (!embeddingScheduleSettings.value.semanticSearchEnabled) {
    return "Semantic search is disabled (SEMANTIC_SEARCH=false).";
  }
  if (!embeddingScheduleSettings.value.hasApiKey) {
    return "Set OPENAI_API_KEY on the server to enable embedding indexing.";
  }
  if (!embeddingScheduleSettings.value.workspaceSchedule.enabled) {
    return "Workspace scheduled sync is off. Turn it on in Settings → Integrations → Sync.";
  }
  if (!embeddingScheduleSettings.value.scheduleEnabled) {
    return "Scheduled indexing is off for this app.";
  }
  return `Indexes pending or stale docs ${embeddingScheduleIntervalLabel.value} (feature, SDD, wiki). Saving still auto-indexes via EMBED_ON_SAVE.`;
});

function formatEmbeddingScheduleTime(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

const statusFilterOptions = [
  { id: "", label: "All statuses" },
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "In review" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];

watch(
  () => route.query.app,
  (app) => {
    appFilter.value = (app as string) || "";
  },
);

watch(
  () => route.query.siteId,
  (siteId) => {
    siteFilter.value = (siteId as string) || "";
  },
);

const appFilterOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

const siteFilterOptions = computed(() => [
  { id: "", label: "All sites" },
  ...docSites.value.map((s) => ({ id: s.id, label: s.name })),
]);

const activeSite = computed(() =>
  siteFilter.value ? docSites.value.find((s) => s.id === siteFilter.value) || null : null,
);

const appOptions = computed(() => [
  { id: "", label: "Unbound (latest)" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

onMounted(async () => {
  await Promise.all([fetchApps(), fetchDocSites(), fetchMcpConfig()]);
  await refreshDocsList();
  if (appFilter.value) {
    void fetchEmbeddingSchedule();
  }
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
});

watch([search, appFilter, siteFilter, statusFilter], async () => {
  await refreshDocsList();
});

watch(siteFilter, (siteId) => {
  const query = { ...route.query };
  if (siteId) query.siteId = siteId;
  else delete query.siteId;
  router.replace({ query });
  createForm.siteId = siteId || "";
});

watch(appFilter, (appId) => {
  createForm.appId = appId;
  if (appId) void fetchEmbeddingSchedule();
  else embeddingScheduleSettings.value = null;
  const query = { ...route.query };
  if (appId) query.app = appId;
  else delete query.app;
  router.replace({ query });
});

const showCreateModal = ref(false);
const createForm = reactive({
  title: "",
  appId: appFilter.value,
  siteId: siteFilter.value,
  slug: "",
  content: "",
  status: "draft",
  tags: [] as string[],
  author: "",
});
const createTitleError = ref(false);

watch(
  () => createForm.title,
  (title) => {
    if (createForm.siteId && (!createForm.slug || createForm.slug === slugify(prevCreateTitle))) {
      createForm.slug = slugify(title);
    }
    prevCreateTitle = title;
  },
);

watch(
  () => createForm.siteId,
  (siteId) => {
    if (siteId && createForm.title.trim()) {
      if (!createForm.slug || createForm.slug === slugify(prevCreateTitle)) {
        createForm.slug = slugify(createForm.title);
      }
    }
  },
);
let prevCreateTitle = "";

function openCreateModal() {
  showCreateModal.value = true;
  createTitleError.value = false;
  createForm.title = "";
  createForm.appId = appFilter.value;
  createForm.siteId = siteFilter.value;
  createForm.slug = "";
  createForm.content = "";
  createForm.status = "draft";
  createForm.tags = [];
  createForm.author = "";
  prevCreateTitle = "";
}

function closeCreateModal() {
  showCreateModal.value = false;
  createTitleError.value = false;
}

async function submitCreate() {
  if (!createForm.title.trim()) {
    createTitleError.value = true;
    return;
  }
  createTitleError.value = false;
  try {
    const doc = await createDoc({
      title: createForm.title.trim(),
      appId: createForm.appId || undefined,
      siteId: createForm.siteId || null,
      slug: createForm.siteId && createForm.slug.trim() ? createForm.slug.trim() : null,
      content: createForm.content,
      status: createForm.status,
      tags: createForm.tags,
      author: createForm.author || undefined,
    });
    closeCreateModal();
    await navigateTo(`/docs/${doc.id}`);
  } catch {
    // Error toast shown by createDoc composable
  }
}

const docToDelete = ref<DocItem | null>(null);

function confirmDelete(doc: DocItem) {
  docToDelete.value = doc;
}

async function doDelete() {
  if (!docToDelete.value) return;
  try {
    await deleteDoc(docToDelete.value.id);
    removeDocFromCaches(docToDelete.value.id);
    await fetchSummary(docView.value, listFilters.value);
    docToDelete.value = null;
  } catch {
    // Error toast shown by deleteDoc composable
  }
}

const pageSubtitle = computed(() => {
  const total = visibleDocCount.value;
  const viewLabel =
    DOC_LIST_VIEW_OPTIONS.find((o) => o.id === docView.value)?.label ?? "All docs";
  if (appFilter.value) {
    const name = apps.value.find((a) => a.id === appFilter.value)?.name ?? "App";
    return `${name} · ${viewLabel.toLowerCase()} · ${total} ${total === 1 ? "doc" : "docs"}.`;
  }
  if (docView.value === "knowledge") {
    return `${total} synced ${total === 1 ? "feature" : "features"}. Bulk status updates apply here.`;
  }
  return `${viewLabel} · ${total} visible ${total === 1 ? "doc" : "docs"} across ${pageStats.value.systems} ${pageStats.value.systems === 1 ? "system" : "systems"}.`;
});

const headerStats = computed(() => [
  { label: "Total docs", value: pageStats.value.total },
  { label: pageStats.value.drafts === 1 ? "Draft" : "Drafts", value: pageStats.value.drafts },
  { label: pageStats.value.systems === 1 ? "System" : "Systems", value: pageStats.value.systems },
]);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (selectedDocIds.value.size > 0) {
      clearSelection();
      return;
    }
    search.value = "";
    appFilter.value = "";
    statusFilter.value = "";
  }
}

function canManageDoc(doc: DocItem): boolean {
  if (isAdrDoc(doc)) return canWriteAdrs.value;
  return canWriteDocs.value;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusClass: Record<string, string> = {
  draft: "pill-blue",
  in_review: "pill-amber",
  published: "pill-green",
  archived: "pill-muted",
};

const statusLabel: Record<string, string> = {
  draft: "DRAFT",
  in_review: "IN REVIEW",
  published: "PUBLISHED",
  archived: "ARCHIVED",
};

const docGroups = computed(() =>
  buildAccordionGroups(apps.value, docView.value, canReadDraftAdrs.value, appFilter.value),
);

const isLoading = computed(() => isSummaryLoading.value);

const visibleDocCount = computed(() => {
  if (docView.value === "knowledge") return knowledgeCount.value;
  return summary.value?.stats.total ?? 0;
});

const showKnowledgeCard = computed(
  () =>
    docView.value === "all"
    && knowledgeCount.value > 0
    && bulkSelectionEnabled.value,
);

const accordionGroups = computed(() => docGroups.value);

const knowledgeDocs = computed(() => knowledgeCatalogDocs());

const knowledgeCount = computed(
  () => summary.value?.viewCounts.knowledge ?? knowledgeDocs.value.length,
);

const pageStats = computed(() => {
  if (summary.value) return summary.value.stats;
  return { total: 0, drafts: 0, systems: 0 };
});

const expandedGroups = ref<Set<string>>(new Set());
const expandedKnowledgeSections = ref<Set<string>>(new Set());

async function refreshDocsList() {
  const previouslyExpanded = [...expandedGroups.value];
  resetAppLoads();
  resetKnowledge();
  await fetchSummary(docView.value, listFilters.value);
  if (docView.value === "knowledge") {
    await fetchKnowledgePage(listFilters.value, true);
    return;
  }
  await Promise.all(
    previouslyExpanded.map((key) =>
      ensureAppLoaded(key, docView.value, listFilters.value, canReadDraftAdrs.value),
    ),
  );
}

watch(docView, async () => {
  await refreshDocsList();
});

watch(
  [accordionGroups, search, appFilter],
  ([groups, q, appId]) => {
    const scoped = !!(q.trim() || appId);
    if (scoped) {
      expandedGroups.value = new Set(groups.map((group) => group.key));
      for (const group of groups) {
        void ensureAppLoaded(
          group.key,
          docView.value,
          listFilters.value,
          canReadDraftAdrs.value,
        );
      }
      return;
    }
    if (groups.length === 1) {
      expandedGroups.value = new Set([groups[0].key]);
      void ensureAppLoaded(
        groups[0].key,
        docView.value,
        listFilters.value,
        canReadDraftAdrs.value,
      );
      return;
    }
    const validKeys = new Set(groups.map((g) => g.key));
    const next = new Set([...expandedGroups.value].filter((key) => validKeys.has(key)));
    expandedGroups.value = next;
  },
  { immediate: true },
);

const showDocsEmptyState = computed(() => {
  if (isLoading.value) return false;
  if (showKnowledgeCard.value) return false;
  if (docView.value === "knowledge") return visibleDocCount.value === 0;
  return accordionGroups.value.length === 0;
});

const knowledgeHasMore = computed(() => knowledgeDocs.value.length < knowledgeTotal.value);

function isKnowledgeSectionCollapsed(groupKey: string, section: DocListSection) {
  if (!shouldCollapseKnowledgeSection(section)) return false;
  return !expandedKnowledgeSections.value.has(sectionCollapseKey(groupKey, section.kind));
}

function toggleKnowledgeSection(groupKey: string, section: DocListSection) {
  const key = sectionCollapseKey(groupKey, section.kind);
  const next = new Set(expandedKnowledgeSections.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKnowledgeSections.value = next;
}

function openKnowledgeSection(groupKey: string, section: DocListSection) {
  expandedKnowledgeSections.value = new Set([
    ...expandedKnowledgeSections.value,
    sectionCollapseKey(groupKey, section.kind),
  ]);
  if (!isGroupExpanded(groupKey)) toggleGroup(groupKey);
}

function isGroupExpanded(groupKey: string) {
  return expandedGroups.value.has(groupKey);
}

function toggleGroup(groupKey: string) {
  const next = new Set(expandedGroups.value);
  const expanding = !next.has(groupKey);
  if (next.has(groupKey)) next.delete(groupKey);
  else next.add(groupKey);
  expandedGroups.value = next;
  if (expanding) {
    void ensureAppLoaded(groupKey, docView.value, listFilters.value, canReadDraftAdrs.value);
  }
}

const allGroupsExpanded = computed(
  () =>
    accordionGroups.value.length > 0
    && accordionGroups.value.every((group) => expandedGroups.value.has(group.key)),
);

function toggleAllGroups() {
  if (allGroupsExpanded.value) {
    expandedGroups.value = new Set();
    return;
  }
  const keys = accordionGroups.value.map((group) => group.key);
  expandedGroups.value = new Set(keys);
  for (const key of keys) {
    void ensureAppLoaded(key, docView.value, listFilters.value, canReadDraftAdrs.value);
  }
}

const docViewCounts = computed(() => {
  if (summary.value?.viewCounts) return summary.value.viewCounts;
  return {
    all: 0,
    product: 0,
    knowledge: 0,
    adrs: 0,
  } satisfies Record<DocListView, number>;
});

function docViewTabLabel(option: (typeof DOC_LIST_VIEW_OPTIONS)[number]) {
  const count = docViewCounts.value[option.id];
  return count > 0 ? `${option.label} (${count})` : option.label;
}

function groupDocCount(group: DocListGroup) {
  if (group.key === "__unbound__") return unboundDocCount(group);
  return appDocCount(group.key, group);
}

function appLoadState(groupKey: string) {
  return appLoads.value.get(groupKey);
}

function canLoadMoreAppDocs(groupKey: string) {
  const state = appLoadState(groupKey);
  return !!state?.loaded && state.docs.length < state.total;
}

function showKnowledgeBase() {
  docView.value = "knowledge";
  nextTick(() => {
    document.getElementById("knowledge-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function selectDocView(view: DocListView) {
  docView.value = view;
  if (view === "knowledge") {
    nextTick(() => {
      document.getElementById("knowledge-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function sectionLabel(section: DocListSection) {
  if (section.kind === "product") return "Product documentation";
  if (section.kind === "architectural_decisions") return "Architectural decisions";
  return section.label;
}

/** Bulk status is for Knowledge base (synced feature) docs only. */
const bulkSelectionEnabled = computed(
  () =>
    docView.value !== "product" &&
    docView.value !== "adrs" &&
    canBulkUpdateDocs.value
);

const selectedDocIds = ref<Set<string>>(new Set());
const bulkStatus = ref<DocItem["status"]>("published");
const isBulkUpdating = ref(false);

const selectableKnowledgeIds = computed(() => {
  if (!bulkSelectionEnabled.value) return [] as string[];
  return knowledgeDocs.value.map((doc) => doc.id);
});

const selectedCount = computed(() => selectedDocIds.value.size);

const allVisibleSelected = computed(
  () =>
    selectableKnowledgeIds.value.length > 0
    && selectableKnowledgeIds.value.every((id) => selectedDocIds.value.has(id)),
);

const someVisibleSelected = computed(
  () => selectableKnowledgeIds.value.some((id) => selectedDocIds.value.has(id)),
);

const bulkStatusOptions: { value: DocItem["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function clearSelection() {
  selectedDocIds.value = new Set();
}

function toggleDocSelection(docId: string) {
  const next = new Set(selectedDocIds.value);
  if (next.has(docId)) next.delete(docId);
  else next.add(docId);
  selectedDocIds.value = next;
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    const visible = new Set(selectableKnowledgeIds.value);
    selectedDocIds.value = new Set(
      [...selectedDocIds.value].filter((id) => !visible.has(id)),
    );
    return;
  }
  selectedDocIds.value = new Set([
    ...selectedDocIds.value,
    ...selectableKnowledgeIds.value,
  ]);
}

async function applyBulkStatus() {
  if (!selectedCount.value || isBulkUpdating.value) return;
  const needsPublish = bulkStatus.value === "published" || bulkStatus.value === "archived";
  if (needsPublish && !can("docs:publish")) return;
  if (!can("docs:write")) return;
  const ids = [...selectedDocIds.value];
  isBulkUpdating.value = true;
  try {
    await bulkUpdateStatus(ids, bulkStatus.value);
    clearSelection();
    await refreshDocsList();
  } catch {
    // toast in composable
  } finally {
    isBulkUpdating.value = false;
  }
}

watch([docView, search, appFilter, siteFilter, statusFilter], () => {
  clearSelection();
});

watch(knowledgeDocs, () => {
  const valid = new Set(knowledgeDocs.value.map((d) => d.id));
  const next = new Set([...selectedDocIds.value].filter((id) => valid.has(id)));
  if (next.size !== selectedDocIds.value.size) selectedDocIds.value = next;
});
</script>

<template>
  <div class="docs-page">
    <GeneralPageHeader
      v-model:search="search"
      title="Docs"
      :subtitle="pageSubtitle"
      search-placeholder="Search docs..."
      search-label="Search docs"
      :stats="headerStats"
      stats-label="Docs summary"
    >
      <template v-if="canRunDocGeneration || canWriteDocs" #actions>
        <NuxtLink v-if="canRunDocGeneration" to="/docs/generate" class="btn btn-secondary">
          <span class="btn-sparkle" aria-hidden="true">✦</span>
          Generate Docs
        </NuxtLink>
        <button v-if="canWriteDocs" type="button" class="btn btn-primary" @click="openCreateModal">
          + New Doc
        </button>
      </template>
      <template #nav>
        <div class="docs-view-tabs" role="tablist" aria-label="Document types">
          <button
            v-for="option in DOC_LIST_VIEW_OPTIONS"
            :key="option.id"
            type="button"
            role="tab"
            class="docs-view-tab"
            :class="{ active: docView === option.id }"
            :aria-selected="docView === option.id"
            @click="selectDocView(option.id)"
          >
            {{ docViewTabLabel(option) }}
          </button>
        </div>
        <div v-if="activeSite" class="site-context-banner">
          <div class="site-context-text">
            <span class="site-context-label">Doc site</span>
            <strong>{{ activeSite.name }}</strong>
            <span class="site-context-slug num">
              {{ preferInternalWiki ? `/wiki/${activeSite.slug}` : `/s/${activeSite.slug}` }}
            </span>
          </div>
          <div class="site-context-actions">
            <NuxtLink :to="`/wiki/${activeSite.slug}`" class="btn btn-primary btn-sm">
              Browse wiki
            </NuxtLink>
            <NuxtLink v-if="canManageDocSites" :to="`/sites/${activeSite.id}`" class="btn btn-secondary btn-sm">
              Manage site
            </NuxtLink>
            <NuxtLink
              v-if="activeSite.status === 'published'"
              :to="`/s/${activeSite.slug}`"
              target="_blank"
              class="btn btn-ghost btn-sm"
            >
              Public view ↗
            </NuxtLink>
          </div>
        </div>
      </template>
      <template #filters>
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="All apps"
          search-placeholder="Search apps..."
        />
        <GeneralSearchableDropdown
          v-if="docSites.length > 0"
          v-model="siteFilter"
          :options="siteFilterOptions"
          placeholder="All sites"
          search-placeholder="Search sites..."
        />
        <GeneralSearchableDropdown
          v-model="statusFilter"
          :options="statusFilterOptions"
          placeholder="All statuses"
          search-placeholder="Filter status..."
        />
      </template>
    </GeneralPageHeader>

    <div
      v-if="appFilter && canWriteDocs"
      class="embedding-schedule-section"
    >
      <div class="embedding-schedule-header">
        <div>
          <h2>Scheduled semantic index</h2>
          <p class="embedding-schedule-desc">
            Automatically catches up feature, SDD, and wiki docs that are unindexed or need re-indexing.
            Uses the same workspace schedule as Notion sync and Generate Docs.
          </p>
        </div>
      </div>

      <div v-if="isLoadingEmbeddingSchedule" class="embedding-schedule-skeleton">
        Loading index settings…
      </div>

      <template v-else-if="embeddingScheduleSettings">
        <div class="toggle embedding-schedule-toggle">
          <button
            class="toggle-switch"
            :class="{ on: embeddingScheduleSettings.scheduleEnabled }"
            aria-label="Toggle scheduled semantic index"
            :disabled="isSavingEmbeddingSchedule"
            @click="toggleEmbeddingSchedule"
          />
          <div>
            <div class="toggle-label">Scheduled semantic index</div>
            <div class="toggle-desc">
              {{
                embeddingScheduleSettings.scheduleEnabled
                  ? embeddingScheduleActive
                    ? `Active · ${embeddingScheduleIntervalLabel}`
                    : "On for this app, waiting for workspace scheduled sync"
                  : "Off for this app"
              }}
            </div>
          </div>
        </div>

        <div class="embedding-schedule-meta">
          <span>Last run: {{ formatEmbeddingScheduleTime(embeddingScheduleSettings.lastRunAt) }}</span>
          <template v-if="embeddingScheduleSettings.lastRunStatus && embeddingScheduleSettings.lastRunStatus !== 'idle'">
            · {{ embeddingScheduleSettings.lastRunStatus }}
          </template>
          <template v-if="embeddingScheduleSettings.lastRunResult">
            · {{ embeddingScheduleSettings.lastRunResult.indexed }} indexed,
            {{ embeddingScheduleSettings.lastRunResult.candidates }} candidates
          </template>
        </div>

        <div class="embedding-schedule-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="isRunningEmbeddingSchedule || !embeddingScheduleSettings.hasApiKey"
            @click="runEmbeddingIndexNow"
          >
            <span v-if="isRunningEmbeddingSchedule">Indexing…</span>
            <span v-else>Index now</span>
          </button>
        </div>

        <p v-if="embeddingScheduleHint" class="embedding-schedule-hint">{{ embeddingScheduleHint }}</p>
      </template>
    </div>

    <div
      v-if="bulkSelectionEnabled && selectedCount > 0"
      class="selection-bar active"
      role="region"
      aria-label="Bulk status update"
    >
      <span>
        <span class="num">{{ selectedCount }}</span>
        {{ selectedCount === 1 ? "feature" : "features" }} selected
      </span>
      <label class="selection-status">
        <span class="selection-status-label">Set status</span>
        <select
          v-model="bulkStatus"
          class="select selection-status-select"
          :disabled="isBulkUpdating"
          aria-label="Status to apply"
        >
          <option v-for="o in bulkStatusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="isBulkUpdating"
        @click="applyBulkStatus"
      >
        <span v-if="isBulkUpdating">Updating…</span>
        <span v-else>Update status</span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        style="margin-left: auto;"
        :disabled="isBulkUpdating"
        @click="clearSelection"
      >
        Cancel
      </button>
    </div>

    <GeneralSkeletonAccordionList v-if="isLoading" />

    <div v-else-if="showDocsEmptyState" class="empty-state">
      <p>No docs found.</p>
      <button v-if="canWriteDocs" type="button" class="btn btn-primary" style="margin-top:12px;" @click="openCreateModal">
        Create your first doc
      </button>
    </div>

    <template v-else>
      <div v-if="docView !== 'knowledge'" class="docs-list-shell">
        <div v-if="accordionGroups.length > 1" class="docs-list-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" @click="toggleAllGroups">
            {{ allGroupsExpanded ? "Collapse all systems" : "Expand all systems" }}
          </button>
        </div>
        <div class="accordion-list">
        <section
          v-for="group in accordionGroups"
          :key="group.key"
          class="system-accordion"
        >
          <button
            type="button"
            class="accordion-header"
            :aria-expanded="isGroupExpanded(group.key)"
            @click="toggleGroup(group.key)"
          >
            <ChevronDown
              size="18"
              class="accordion-chevron"
              :class="{ 'is-expanded': isGroupExpanded(group.key) }"
            />
            <span class="accordion-title">{{ group.label }}</span>
            <span class="accordion-count">{{ groupDocCount(group) }} {{ groupDocCount(group) === 1 ? "doc" : "docs" }}</span>
          </button>

          <div v-show="isGroupExpanded(group.key)" class="accordion-body">
            <div v-if="appLoadState(group.key)?.loading" class="accordion-loading">
              <GeneralSkeletonAccordionList />
            </div>
            <div v-else-if="appLoadState(group.key)?.error" class="accordion-error">
              <p>Could not load docs for this system.</p>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                @click="ensureAppLoaded(group.key, docView, listFilters, canReadDraftAdrs)"
              >
                Retry
              </button>
            </div>
            <template v-else>
            <GeneralDataTable :scrollable="true">
              <thead>
                <tr>
                  <th>Doc</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>By</th>
                  <th class="col-actions" />
                </tr>
              </thead>
              <tbody>
                <template v-for="section in group.sections" :key="`${group.key}-${section.kind}`">
                  <tr
                    v-if="section.docs.length > 0 && (section.label || section.kind !== 'product')"
                    class="subsection-row"
                  >
                    <td colspan="5">
                      <div class="subsection-label">
                        <span>{{ sectionLabel(section) }}</span>
                        <span v-if="section.kind === 'architectural_decisions'" class="subsection-count">
                          {{ section.docs.length }} {{ section.docs.length === 1 ? "decision" : "decisions" }}
                        </span>
                        <span v-else-if="section.kind === 'knowledge'" class="subsection-count">
                          {{ section.docs.length }} {{ section.docs.length === 1 ? "feature" : "features" }}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-if="section.docs.length > 0 && isKnowledgeSectionCollapsed(group.key, section)"
                    class="section-summary-row"
                    tabindex="0"
                    @click="openKnowledgeSection(group.key, section)"
                    @keydown.enter.prevent="openKnowledgeSection(group.key, section)"
                  >
                    <td colspan="5">
                      <div class="section-summary">
                        <div class="section-summary-copy">
                          <strong>
                            {{ section.docs.length }} synced
                            {{ section.docs.length === 1 ? "feature" : "features" }}
                          </strong>
                          <span class="section-summary-hint">
                            Large lists stay collapsed so product docs stay easy to scan.
                          </span>
                        </div>
                        <span class="section-summary-action">Expand</span>
                      </div>
                    </td>
                  </tr>
                  <template v-else-if="section.docs.length > 0">
                    <tr
                      v-if="shouldCollapseKnowledgeSection(section)"
                      class="section-expand-hint-row"
                    >
                      <td colspan="5">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm section-collapse-btn"
                          @click="toggleKnowledgeSection(group.key, section)"
                        >
                          Collapse feature list
                        </button>
                      </td>
                    </tr>
                    <tr v-for="doc in section.docs" :key="doc.id">
                    <td>
                      <div class="cell-stack">
                        <span class="col-strong">{{ docListPrimaryLabel(doc) }}</span>
                        <span v-if="docListSecondaryLabel(doc)" class="doc-kind col-truncate">
                          {{ docListSecondaryLabel(doc) }}
                        </span>
                        <span v-if="doc.site" class="doc-site-badge">
                          <NuxtLink :to="`/sites/${doc.site.id}`" class="doc-site-link">
                            {{ doc.site.name }}
                          </NuxtLink>
                          <span v-if="doc.slug" class="doc-site-slug num">
                            {{
                              preferInternalWiki
                                ? `/wiki/${doc.site.slug}/${doc.slug}`
                                : `/s/${doc.site.slug}/${doc.slug}`
                            }}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span v-if="isWikiDoc(doc)" class="pill pill-accent">Wiki</span>
                      <span v-else class="pill" :class="statusClass[doc.status] || 'pill-blue'">
                        {{ statusLabel[doc.status] || doc.status }}
                      </span>
                    </td>
                    <td class="col-num col-muted">{{ formatDate(doc.updatedAt) }}</td>
                    <td class="col-muted">{{ doc.author || "—" }}</td>
                    <td class="col-actions" @click.stop>
                      <div class="cell-actions">
                        <NuxtLink
                          :to="`/docs/${doc.id}`"
                          class="btn btn-ghost btn-sm row-action"
                        >
                          Open
                        </NuxtLink>
                        <button
                          v-if="canManageDoc(doc)"
                          type="button"
                          class="btn btn-ghost btn-sm"
                          title="Delete"
                          @click="confirmDelete(doc)"
                        >
                          <IconsTrash size="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  </template>
                </template>
              </tbody>
            </GeneralDataTable>
            <div v-if="canLoadMoreAppDocs(group.key)" class="accordion-pagination">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="appLoadState(group.key)?.loadingMore"
                @click="loadMoreAppDocs(group.key, docView, listFilters)"
              >
                {{
                  appLoadState(group.key)?.loadingMore
                    ? "Loading…"
                    : `Load more (${groupDocCount(group)} of ${appLoadState(group.key)?.total ?? groupDocCount(group)})`
                }}
              </button>
            </div>
            </template>
          </div>
        </section>

        <button
          v-if="showKnowledgeCard"
          type="button"
          class="knowledge-row"
          @click="showKnowledgeBase"
        >
          <span class="knowledge-row__title">Knowledge base</span>
          <span class="knowledge-row__meta">Bulk status updates and multi-select</span>
          <span class="knowledge-row__cta">Open workspace view</span>
        </button>
        </div>
      </div>

      <div v-else id="knowledge-panel" class="knowledge-panel">
        <div class="knowledge-panel__header">
          <div>
            <h2>Knowledge base</h2>
            <p>{{ knowledgeCount }} synced {{ knowledgeCount === 1 ? "feature" : "features" }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="selectDocView('product')">
            Back to product docs
          </button>
        </div>
        <GeneralSkeletonAccordionList v-if="isKnowledgeLoading" />
        <GeneralDataTable v-else>
          <thead>
            <tr>
              <th v-if="bulkSelectionEnabled" class="check-col">
                <input
                  type="checkbox"
                  class="row-check"
                  :checked="allVisibleSelected"
                  :indeterminate.prop="someVisibleSelected && !allVisibleSelected"
                  :disabled="!selectableKnowledgeIds.length || isBulkUpdating"
                  aria-label="Select all visible Knowledge base docs"
                  @change="toggleSelectAllVisible"
                />
              </th>
              <th>Doc</th>
              <th>Status</th>
              <th>Updated</th>
              <th>By</th>
              <th class="col-actions" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="doc in knowledgeDocs"
              :key="doc.id"
              :class="{ 'is-selected': selectedDocIds.has(doc.id) }"
            >
              <td v-if="bulkSelectionEnabled" class="check-col" @click.stop>
                <input
                  type="checkbox"
                  class="row-check"
                  :checked="selectedDocIds.has(doc.id)"
                  :disabled="isBulkUpdating"
                  :aria-label="`Select ${docListPrimaryLabel(doc)}`"
                  @change="toggleDocSelection(doc.id)"
                />
              </td>
              <td>
                <div class="cell-stack">
                  <span class="col-strong">{{ docListPrimaryLabel(doc) }}</span>
                  <span v-if="docListSecondaryLabel(doc)" class="doc-kind col-truncate">
                    {{ docListSecondaryLabel(doc) }}
                  </span>
                </div>
              </td>
              <td>
                <span v-if="isWikiDoc(doc)" class="pill pill-accent">Wiki</span>
                <span v-else class="pill" :class="statusClass[doc.status] || 'pill-blue'">
                  {{ statusLabel[doc.status] || doc.status }}
                </span>
              </td>
              <td class="col-num col-muted">{{ formatDate(doc.updatedAt) }}</td>
              <td class="col-muted">{{ doc.author || "—" }}</td>
              <td class="col-actions" @click.stop>
                <div class="cell-actions">
                  <NuxtLink
                    :to="`/docs/${doc.id}`"
                    class="btn btn-ghost btn-sm row-action"
                  >
                    Open
                  </NuxtLink>
                  <button
                    v-if="canManageDoc(doc)"
                    type="button"
                    class="btn btn-ghost btn-sm"
                    title="Delete"
                    @click="confirmDelete(doc)"
                  >
                    <IconsTrash size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </GeneralDataTable>
        <div v-if="knowledgeHasMore" class="accordion-pagination">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="isKnowledgeLoadingMore"
            @click="fetchKnowledgePage(listFilters, false)"
          >
            {{ isKnowledgeLoadingMore ? "Loading…" : `Load more (${knowledgeDocs.length} of ${knowledgeTotal})` }}
          </button>
        </div>
      </div>
    </template>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New Doc</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="docTitle">Title</label>
              <input
                id="docTitle"
                v-model="createForm.title"
                type="text"
                placeholder="e.g. API Gateway — Developer Docs"
                required
                :class="{ 'input-error': createTitleError }"
                @input="createTitleError = false"
              />
              <span class="error-msg" :class="{ show: createTitleError }">
                Title is required
              </span>
            </div>
            <div class="form-group">
              <label for="docApp">App</label>
              <GeneralSearchableDropdown
                id="docApp"
                v-model="createForm.appId"
                :options="appOptions"
                placeholder="Select app…"
                search-placeholder="Search apps…"
              />
            </div>
            <div class="form-group">
              <label for="docSite">Doc site <span class="opt">(optional)</span></label>
              <GeneralSearchableDropdown
                id="docSite"
                v-model="createForm.siteId"
                :options="[{ id: '', label: 'Not part of a site' }, ...docSites.map((s) => ({ id: s.id, label: s.name }))]"
                placeholder="Select site…"
                search-placeholder="Search sites…"
              />
            </div>
            <div v-if="createForm.siteId" class="form-group">
              <label for="docSlug">Page slug</label>
              <input
                id="docSlug"
                v-model="createForm.slug"
                type="text"
                class="input"
                placeholder="Auto-generated from title"
              />
              <span class="field-hint">
                {{
                  preferInternalWiki
                    ? `/wiki/${docSites.find((s) => s.id === createForm.siteId)?.slug || "…"}/${createForm.slug || "…"}`
                    : `/s/${docSites.find((s) => s.id === createForm.siteId)?.slug || "…"}/${createForm.slug || "…"}`
                }}
                <span class="field-hint-muted"> · you can edit this</span>
              </span>
            </div>
            <div class="form-group">
              <label for="docAuthor">Author</label>
              <AppOwnerSelect id="docAuthor" v-model="createForm.author" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Create Doc
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!docToDelete }" @click.self="docToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Doc</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="docToDelete = null">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--muted);">
            Are you sure you want to delete <strong>{{ docToDelete?.title }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="docToDelete = null">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" @click="doDelete">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.docs-page {
  /* Inherits global semantic tokens from :root */
}

.docs-view-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  background: var(--fg-soft);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.docs-view-tab {
  padding: 6px 14px;
  border: none;
  border-radius: calc(var(--radius) - 2px);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition:
    background 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.docs-view-tab:hover {
  color: var(--fg);
}

.docs-view-tab.active {
  background: var(--surface);
  color: var(--fg);
  box-shadow: 0 1px 2px color-mix(in oklch, var(--fg) 8%, transparent);
}

.docs-view-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.section-summary-action {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  white-space: nowrap;
}

.section-summary-row:hover .section-summary-action,
.section-summary-row:focus-visible .section-summary-action {
  color: var(--fg);
}

.site-context-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 16px;
  margin-top: 4px;
  margin-bottom: 20px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in oklch, var(--accent) 25%, transparent);
  border-radius: var(--radius-lg);
}

.site-context-text {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 14px;
}

.btn-sparkle {
  font-size: 12px;
  opacity: 0.85;
}

.embedding-schedule-section {
  margin-bottom: 24px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--bg) 92%, var(--fg) 8%);
}

.embedding-schedule-header h2 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.embedding-schedule-desc {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.45;
}

.embedding-schedule-toggle {
  margin-top: 14px;
}

.embedding-schedule-meta {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
}

.embedding-schedule-actions {
  margin-top: 12px;
}

.embedding-schedule-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}

.embedding-schedule-skeleton {
  margin-top: 12px;
  min-height: 48px;
  font-size: 12px;
  color: var(--muted);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  border: none;
  padding: 0;
}

.toggle-switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-switch.on {
  background: var(--accent);
}

.toggle-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.on::after {
  transform: translateX(18px);
}

.toggle-label {
  font-size: 14px;
  color: var(--fg);
}

.toggle-desc {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

.docs-list-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.accordion-pagination {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

.accordion-loading,
.accordion-error {
  padding: 16px;
}

.accordion-error {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
}

.docs-list-toolbar {
  display: flex;
  justify-content: flex-end;
}

.accordion-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.system-accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}

.accordion-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--fg);
  transition: background 0.15s ease;
}

.accordion-header:hover {
  background: var(--fg-soft);
}

.accordion-chevron {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.accordion-chevron :deep(path) {
  stroke: currentColor;
}

.accordion-chevron.is-expanded {
  transform: rotate(180deg);
}

.accordion-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.accordion-count {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}

.accordion-body {
  border-top: 1px solid var(--border);
}

.accordion-body :deep(.table-panel) {
  border: none;
  border-radius: 0;
  background: transparent;
}

.knowledge-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 0;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--fg);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.knowledge-row:hover {
  background: var(--fg-soft);
  border-color: color-mix(in oklch, var(--fg) 18%, var(--border));
}

.knowledge-row__title {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.knowledge-row__meta {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--muted);
}

.knowledge-row__cta {
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.knowledge-panel {
  margin-bottom: 16px;
}

.knowledge-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.knowledge-panel__header h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}

.knowledge-panel__header p {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.cell-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
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

.doc-site-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}
.doc-site-link {
  color: var(--accent);
  text-decoration: none;
}
.doc-site-link:hover {
  text-decoration: underline;
}
.doc-site-slug {
  font-size: 10px;
  opacity: 0.8;
}

.site-context-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}
.site-context-slug {
  font-size: 12px;
  color: var(--muted);
}
.site-context-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.field-hint {
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
}
.field-hint-muted {
  font-family: var(--font-body);
  font-style: italic;
}
.opt {
  color: var(--muted);
  font-weight: 400;
}

.selection-bar {
  display: none;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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
.selection-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.selection-status-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.selection-status-select {
  width: auto;
  min-width: 140px;
  padding: 5px 10px;
  font-size: 13px;
}
.row-check {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.01em;
}
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
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
.pill-muted {
  background: color-mix(in oklch, var(--muted) 12%, transparent);
  color: var(--muted);
}
.pill-purple {
  background: color-mix(in oklch, oklch(55% 0.2 295) 12%, transparent);
  color: oklch(50% 0.16 295);
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
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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
  background: var(--error-text);
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
.form-group input,
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
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-error {
  border-color: var(--error) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--error) 20%, transparent) !important;
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
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .knowledge-row {
    flex-wrap: wrap;
  }

  .knowledge-row__meta {
    flex-basis: 100%;
    order: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal,
  .btn,
  .accordion-chevron {
    transition: none !important;
  }
}
</style>
