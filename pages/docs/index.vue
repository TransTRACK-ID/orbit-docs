<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { DocItem } from "~/composables/useDocs";
import ChevronDown from "~/components/icons/ChevronDown/index.vue";
import {
  docListPrimaryLabel,
  docListSecondaryLabel,
  filterDocsByView,
  groupDocsForList,
  isAdrDoc,
  isFeatureCatalogDoc,
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
const { docs, isLoading, search, fetchDocs, createDoc, deleteDoc, bulkUpdateStatus } = useDocs();

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
const docView = ref<DocListView>("all");

const docViewOptions: { id: DocListView; label: string }[] = [
  { id: "all", label: "Semua jenis" },
  { id: "product", label: "Dokumentasi produk" },
  { id: "knowledge", label: "Knowledge base" },
  { id: "adrs", label: "Keputusan arsitektur" },
];

const statusFilterOptions = [
  { id: "", label: "Semua status" },
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "Dalam review" },
  { id: "published", label: "Dipublikasi" },
  { id: "archived", label: "Diarsipkan" },
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
  { id: "", label: "Semua apps" },
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
  await fetchDocs({
    appId: appFilter.value,
    siteId: siteFilter.value || undefined,
    status: statusFilter.value || undefined,
  });
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("click", onClickOutside);
});

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".actions-menu")) {
    docs.value.forEach((d: any) => (d._showActions = false));
  }
}

watch([search, appFilter, siteFilter, statusFilter], async () => {
  await fetchDocs({
    appId: appFilter.value,
    siteId: siteFilter.value || undefined,
    status: statusFilter.value || undefined,
  });
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
    docToDelete.value = null;
  } catch {
    // Error toast shown by deleteDoc composable
  }
}

function onSearch() {
  fetchDocs({
    appId: appFilter.value,
    siteId: siteFilter.value || undefined,
    status: statusFilter.value || undefined,
  });
}

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

function hasDocMenuActions(doc: DocItem): boolean {
  return canManageDoc(doc) || doc.status === "published";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
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
  groupDocsForList(docs.value, docView.value, {
    includeDraftAdrs: canReadDraftAdrs.value,
  })
);

const visibleDocCount = computed(() => {
  if (docView.value === "knowledge") return knowledgeDocs.value.length;
  return accordionGroups.value.reduce(
    (total, group) => total + groupDocCount(group),
    0,
  );
});

const showKnowledgeCard = computed(
  () => docView.value !== "knowledge" && knowledgeCount.value > 0,
);

const accordionGroups = computed(() =>
  docGroups.value
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => section.kind !== "knowledge"),
    }))
    .filter((group) => group.sections.some((section) => section.docs.length > 0)),
);

const knowledgeDocs = computed(() => {
  const filtered = filterDocsByView(docs.value, "knowledge");
  return filtered.filter(isFeatureCatalogDoc);
});

const knowledgeCount = computed(() => knowledgeDocs.value.length);

const pageStats = computed(() => {
  const base = filterDocsByView(docs.value, docView.value === "knowledge" ? "all" : docView.value, {
    includeDraftAdrs: canReadDraftAdrs.value,
  });
  const catalog = base.filter((doc) => !isFeatureCatalogDoc(doc));
  const draftCount = catalog.filter((doc) => doc.status === "draft").length;
  const systemIds = new Set(
    catalog.filter((doc) => doc.app?.id).map((doc) => doc.app!.id),
  );
  return {
    total: catalog.length,
    drafts: draftCount,
    systems: systemIds.size,
  };
});

const expandedGroups = ref<Set<string>>(new Set());

watch(
  accordionGroups,
  (groups) => {
    expandedGroups.value = new Set(groups.map((group) => group.key));
  },
  { immediate: true },
);

function isGroupExpanded(groupKey: string) {
  return expandedGroups.value.has(groupKey);
}

function toggleGroup(groupKey: string) {
  const next = new Set(expandedGroups.value);
  if (next.has(groupKey)) next.delete(groupKey);
  else next.add(groupKey);
  expandedGroups.value = next;
}

function groupDocCount(group: DocListGroup) {
  return group.sections.reduce((sum, section) => sum + section.docs.length, 0);
}

function showKnowledgeBase() {
  docView.value = "knowledge";
  nextTick(() => {
    document.getElementById("knowledge-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
  } catch {
    // toast in composable
  } finally {
    isBulkUpdating.value = false;
  }
}

watch([docView, search, appFilter, siteFilter, statusFilter], () => {
  clearSelection();
});

watch(docs, () => {
  const valid = new Set(docs.value.filter(isFeatureCatalogDoc).map((d) => d.id));
  const next = new Set([...selectedDocIds.value].filter((id) => valid.has(id)));
  if (next.size !== selectedDocIds.value.size) selectedDocIds.value = next;
});
</script>

<template>
  <div class="docs-page">
    <header class="page-masthead">
      <div class="page-masthead__copy">
        <h1>Docs</h1>
        <p class="page-subtitle">
          Semua dokumentasi lintas aplikasi, dikelompokkan per sistem dan jenis dokumen.
        </p>
      </div>
      <div class="page-masthead__actions">
        <NuxtLink v-if="canRunDocGeneration" to="/docs/generate" class="btn btn-secondary">
          <span class="btn-sparkle" aria-hidden="true">✦</span>
          Generate Docs
        </NuxtLink>
        <button v-if="canWriteDocs" type="button" class="btn btn-primary" @click="openCreateModal">
          + Dokumen Baru
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
          v-model="search"
          class="search"
          placeholder="Cari dokumen..."
          aria-label="Cari dokumen"
          @input="onSearch"
        />
      </div>
      <div class="filter-group">
        <GeneralSearchableDropdown
          v-model="docView"
          :options="docViewOptions"
          placeholder="Semua jenis"
          search-placeholder="Filter jenis..."
        />
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="Semua apps"
          search-placeholder="Cari app..."
        />
        <GeneralSearchableDropdown
          v-model="statusFilter"
          :options="statusFilterOptions"
          placeholder="Semua status"
          search-placeholder="Filter status..."
        />
      </div>
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

    <div class="stats-bar">
      <div class="stat">
        <span class="stat-num num">{{ pageStats.total }}</span>
        <span class="stat-label">Total dokumen</span>
      </div>
      <div class="stat">
        <span class="stat-num num">{{ pageStats.drafts }}</span>
        <span class="stat-label">Draft aktif</span>
      </div>
      <div class="stat">
        <span class="stat-num num">{{ pageStats.systems }}</span>
        <span class="stat-label">Sistem</span>
      </div>
    </div>

    <div
      v-if="bulkSelectionEnabled && selectedCount > 0"
      class="selection-bar active"
      role="region"
      aria-label="Bulk status update"
    >
      <span>
        <span class="num">{{ selectedCount }}</span>
        fitur dipilih
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
        <span v-if="isBulkUpdating">Memperbarui…</span>
        <span v-else>Perbarui status</span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        style="margin-left: auto;"
        :disabled="isBulkUpdating"
        @click="clearSelection"
      >
        Batal
      </button>
    </div>

    <GeneralSkeletonAccordionList v-if="isLoading" />

    <div v-else-if="visibleDocCount === 0 && !showKnowledgeCard" class="empty-state">
      <p>Tidak ada dokumen ditemukan.</p>
      <button v-if="canWriteDocs" type="button" class="btn btn-primary" style="margin-top:12px;" @click="openCreateModal">
        Buat dokumen pertama
      </button>
    </div>

    <template v-else>
      <div v-if="docView !== 'knowledge'" class="accordion-list">
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
            <span class="accordion-count">{{ groupDocCount(group) }} dokumen</span>
          </button>

          <div v-show="isGroupExpanded(group.key)" class="accordion-body">
            <GeneralDataTable :scrollable="true">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Status</th>
                  <th>Diperbarui</th>
                  <th>Oleh</th>
                  <th class="col-actions" />
                </tr>
              </thead>
              <tbody>
                <template v-for="section in group.sections" :key="`${group.key}-${section.kind}`">
                  <tr
                    v-if="section.label || section.kind !== 'product'"
                    class="subsection-row"
                  >
                    <td colspan="5">
                      <div class="subsection-label">
                        <span>{{ sectionLabel(section) }}</span>
                        <span v-if="section.kind === 'architectural_decisions'" class="subsection-count">
                          {{ section.docs.length }} keputusan
                        </span>
                      </div>
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
                      <span class="pill" :class="statusClass[doc.status] || 'pill-blue'">
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
                          Buka &rarr;
                        </NuxtLink>
                        <div
                          v-if="hasDocMenuActions(doc)"
                          class="action-dropdown-wrap actions-menu"
                        >
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm row-action row-action--icon"
                            aria-label="Aksi lainnya"
                            aria-haspopup="menu"
                            :aria-expanded="!!doc._showActions"
                            @click="doc._showActions = !doc._showActions"
                          >
                            <IconsDotsVertical size="14" />
                          </button>
                          <div
                            v-if="doc._showActions"
                            class="dropdown-menu actions-dropdown"
                            role="menu"
                            @click.stop
                          >
                            <NuxtLink
                              v-if="doc.status === 'published'"
                              :to="`/p/${doc.id}`"
                              target="_blank"
                              class="dropdown-item"
                              role="menuitem"
                              @click="doc._showActions = false"
                            >
                              Public view
                            </NuxtLink>
                            <button
                              v-if="canManageDoc(doc)"
                              type="button"
                              class="dropdown-item dropdown-item--danger"
                              role="menuitem"
                              @click="doc._showActions = false; confirmDelete(doc)"
                            >
                              <IconsTrash size="14" />
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </GeneralDataTable>
          </div>
        </section>

        <button
          v-if="showKnowledgeCard"
          type="button"
          class="knowledge-row"
          @click="showKnowledgeBase"
        >
          <span class="knowledge-row__title">Knowledge base</span>
          <span class="knowledge-row__meta">{{ knowledgeCount }} fitur tersinkron</span>
          <span class="knowledge-row__cta">Lihat semua</span>
        </button>
      </div>

      <div v-else id="knowledge-panel" class="knowledge-panel">
        <div class="knowledge-panel__header">
          <div>
            <h2>Knowledge base</h2>
            <p>{{ knowledgeCount }} fitur tersinkron</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="docView = 'all'">
            Kembali
          </button>
        </div>
        <GeneralDataTable>
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
              <th>Dokumen</th>
              <th>Status</th>
              <th>Diperbarui</th>
              <th>Oleh</th>
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
                <span class="pill" :class="statusClass[doc.status] || 'pill-blue'">
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
                    Buka &rarr;
                  </NuxtLink>
                  <div
                    v-if="hasDocMenuActions(doc)"
                    class="action-dropdown-wrap actions-menu"
                  >
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm row-action row-action--icon"
                      aria-label="Aksi lainnya"
                      aria-haspopup="menu"
                      :aria-expanded="!!doc._showActions"
                      @click="doc._showActions = !doc._showActions"
                    >
                      <IconsDotsVertical size="14" />
                    </button>
                    <div
                      v-if="doc._showActions"
                      class="dropdown-menu actions-dropdown"
                      role="menu"
                      @click.stop
                    >
                      <button
                        v-if="canManageDoc(doc)"
                        type="button"
                        class="dropdown-item dropdown-item--danger"
                        role="menuitem"
                        @click="doc._showActions = false; confirmDelete(doc)"
                      >
                        <IconsTrash size="14" />
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </GeneralDataTable>
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

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.btn-sparkle {
  font-size: 12px;
  opacity: 0.85;
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
  gap: 2px;
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

.site-context-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 16px;
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
  background: oklch(50% 0.18 25);
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
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .page-masthead {
    flex-direction: column;
    align-items: stretch;
  }

  .page-masthead__actions {
    justify-content: flex-end;
  }

  .filter-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrap {
    max-width: none;
    flex-basis: auto;
  }

  .filter-group {
    width: 100%;
  }

  .stats-bar {
    gap: 16px;
  }

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
