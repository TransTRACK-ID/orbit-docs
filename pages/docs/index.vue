<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { DocItem } from "~/composables/useDocs";
import DotsVertical from "~/components/icons/DotsVertical/index.vue";
import {
  DOC_LIST_VIEW_OPTIONS,
  docListPrimaryLabel,
  docListSecondaryLabel,
  groupDocsForList,
  sectionCollapseKey,
  shouldCollapseKnowledgeSection,
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
const { docs, isLoading, search, fetchDocs, createDoc, deleteDoc } = useDocs();
const { apps, fetchApps } = useApps();
const { docSites, fetchDocSites } = useDocSites();

const appFilter = ref((route.query.app as string) || "");
const siteFilter = ref((route.query.siteId as string) || "");
const docView = ref<DocListView>("all");

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
  await Promise.all([fetchApps(), fetchDocSites()]);
  await fetchDocs({ appId: appFilter.value, siteId: siteFilter.value || undefined });
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

watch([search, appFilter, siteFilter], async () => {
  await fetchDocs({
    appId: appFilter.value,
    siteId: siteFilter.value || undefined,
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
  fetchDocs({ appId: appFilter.value });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    search.value = "";
    appFilter.value = "";
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
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
  draft: "Draft",
  in_review: "In Review",
  published: "Published",
  archived: "Archived",
};

const docGroups = computed(() => groupDocsForList(docs.value, docView.value));

const visibleDocCount = computed(() =>
  docGroups.value.reduce(
    (total, group) => total + group.sections.reduce((sum, section) => sum + section.docs.length, 0),
    0,
  ),
);

const showAppHeaders = computed(
  () => !appFilter.value && docGroups.value.length > 1,
);

const expandedSections = ref<Set<string>>(new Set());

function isSectionCollapsed(groupKey: string, section: { kind: "product" | "knowledge"; docs: DocItem[] }) {
  if (section.kind !== "knowledge" || !shouldCollapseKnowledgeSection(section)) {
    return false;
  }
  return !expandedSections.value.has(sectionCollapseKey(groupKey, section.kind));
}

function toggleSection(groupKey: string, sectionKind: "product" | "knowledge") {
  const key = sectionCollapseKey(groupKey, sectionKind);
  const next = new Set(expandedSections.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedSections.value = next;
}

const pageSubtitle = computed(() => {
  if (activeSite.value) return `Pages in ${activeSite.value.name}`;
  if (docView.value === "product") return "SRS, FSD, SDD, and manual docs";
  if (docView.value === "knowledge") return "Synced feature catalog from spreadsheets";
  return "All documentation across apps";
});

const tableColspan = 5;
</script>

<template>
  <div class="docs-page">
    <header class="topbar">
      <div class="flex-gap-md">
        <h1>Docs</h1>
        <span class="text-muted-sm">{{ pageSubtitle }}</span>
      </div>
      <div class="flex-gap-md topbar-actions">
        <input
          v-model="search"
          class="search"
          placeholder="Search docs…"
          aria-label="Search docs"
          @input="onSearch"
        />
        <GeneralSearchableDropdown
          v-model="docView"
          :options="DOC_LIST_VIEW_OPTIONS"
          placeholder="Doc type…"
          search-placeholder="Filter type…"
        />
        <GeneralSearchableDropdown
          v-model="appFilter"
          :options="appFilterOptions"
          placeholder="Filter by app…"
          search-placeholder="Search apps…"
        />
        <GeneralSearchableDropdown
          v-model="siteFilter"
          :options="siteFilterOptions"
          placeholder="Filter by site…"
          search-placeholder="Search sites…"
        />
        <NuxtLink to="/docs/generate" class="btn btn-secondary">
          ✦ Generate Docs
        </NuxtLink>
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Doc
        </button>
      </div>
    </header>

    <div v-if="activeSite" class="site-context-banner">
      <div class="site-context-text">
        <span class="site-context-label">Doc site</span>
        <strong>{{ activeSite.name }}</strong>
        <span class="site-context-slug num">/s/{{ activeSite.slug }}</span>
      </div>
      <div class="site-context-actions">
        <NuxtLink :to="`/sites/${activeSite.id}`" class="btn btn-secondary btn-sm">
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

    <GeneralDataTable v-if="isLoading">
      <tbody>
        <tr v-for="n in 5" :key="n" class="skeleton-row">
          <td :colspan="tableColspan"><div class="skeleton-bar w-two-thirds" /></td>
        </tr>
      </tbody>
    </GeneralDataTable>

    <div v-else-if="visibleDocCount === 0" class="empty-state">
      <p>No docs found.</p>
      <button type="button" class="btn btn-primary" style="margin-top:12px;" @click="openCreateModal">
        Create your first doc
      </button>
    </div>

    <GeneralDataTable v-else>
      <thead>
        <tr>
          <th>Document</th>
          <th>Status</th>
          <th>Updated</th>
          <th>By</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="group in docGroups" :key="group.key">
          <tr v-if="showAppHeaders" class="group-row">
            <td :colspan="tableColspan">{{ group.label }}</td>
          </tr>
          <template v-for="section in group.sections" :key="`${group.key}-${section.kind}`">
            <tr v-if="section.label" class="subsection-row">
              <td :colspan="tableColspan">
                <div class="subsection-label">
                  <span>{{ section.label }}</span>
                  <span v-if="section.kind === 'knowledge'" class="subsection-count">
                    {{ section.docs.length }} features
                  </span>
                </div>
              </td>
            </tr>
            <tr
              v-if="isSectionCollapsed(group.key, section)"
              class="section-summary-row"
              tabindex="0"
              role="button"
              :aria-expanded="false"
              @click="toggleSection(group.key, section.kind)"
              @keydown.enter.prevent="toggleSection(group.key, section.kind)"
              @keydown.space.prevent="toggleSection(group.key, section.kind)"
            >
              <td :colspan="tableColspan">
                <div class="section-summary">
                  <div class="section-summary-copy">
                    <strong>{{ section.docs.length }} synced features</strong>
                    <span class="section-summary-hint">Spreadsheet rows are grouped here so product docs stay easy to scan.</span>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" @click.stop="toggleSection(group.key, section.kind)">
                    Show all
                  </button>
                </div>
              </td>
            </tr>
            <template v-else>
              <tr
                v-if="section.kind === 'knowledge' && shouldCollapseKnowledgeSection(section)"
                class="section-expand-hint-row"
              >
                <td :colspan="tableColspan">
                  <button type="button" class="btn btn-ghost btn-sm section-collapse-btn" @click="toggleSection(group.key, section.kind)">
                    Collapse knowledge base
                  </button>
                </td>
              </tr>
              <tr v-for="doc in section.docs" :key="doc.id">
            <td>
              <div class="cell-stack">
                <NuxtLink :to="`/docs/${doc.id}`" class="col-strong doc-title-link">
                  {{ docListPrimaryLabel(doc) }}
                </NuxtLink>
                <span v-if="docListSecondaryLabel(doc)" class="doc-kind col-truncate">
                  {{ docListSecondaryLabel(doc) }}
                </span>
                <span v-if="doc.site" class="doc-site-badge">
                  <NuxtLink :to="`/sites/${doc.site.id}`" class="doc-site-link">
                    {{ doc.site.name }}
                  </NuxtLink>
                  <span v-if="doc.slug" class="doc-site-slug num">/s/{{ doc.site.slug }}/{{ doc.slug }}</span>
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
            <td class="col-actions">
              <div class="cell-actions">
                <NuxtLink :to="`/docs/${doc.id}`" class="btn btn-primary btn-sm">
                  Open
                </NuxtLink>
                <div class="actions-menu">
                  <button type="button" class="btn btn-ghost btn-sm actions-toggle" aria-label="More actions" @click="doc._showActions = !doc._showActions">
                    <DotsVertical />
                  </button>
                  <div v-if="doc._showActions" class="actions-dropdown" @click.stop>
                    <NuxtLink
                      v-if="doc.status === 'published'"
                      :to="`/p/${doc.id}`"
                      target="_blank"
                      class="actions-item"
                      @click="doc._showActions = false"
                    >
                      Public View
                    </NuxtLink>
                    <button type="button" class="actions-item actions-danger" @click="doc._showActions = false; confirmDelete(doc)">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
            </template>
          </template>
        </template>
      </tbody>
    </GeneralDataTable>

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
                /s/{{ docSites.find((s) => s.id === createForm.siteId)?.slug || "…" }}/{{ createForm.slug || "…" }}
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
  /* Inherits global semantic tokens from :root — no local overrides so dark mode works */
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

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.topbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
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

.doc-title-link {
  color: var(--fg);
  text-decoration: none;
}

.doc-title-link:hover {
  color: var(--accent);
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

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
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
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
}
.actions-menu {
  position: relative;
}
.actions-toggle {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--muted);
  background: transparent;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.actions-toggle:hover {
  border-color: var(--fg);
  color: var(--fg);
  background: var(--surface);
}
.actions-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 10%, transparent);
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 4px;
  overflow: hidden;
}
.actions-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--fg);
  text-decoration: none;
  border-radius: var(--radius);
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  transition: background 0.15s;
}
.actions-item:hover {
  background: color-mix(in oklch, var(--fg) 7%, transparent);
}
.actions-danger {
  color: oklch(50% 0.16 25);
}
.actions-danger:hover {
  background: color-mix(in oklch, oklch(55% 0.16 25) 10%, transparent);
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

.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.flex-gap-sm {
  display: flex;
  gap: 8px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 768px) {
  .search {
    width: 180px;
  }
  .topbar {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .doc-card,
  .modal-overlay,
  .modal,
  .btn {
    transition: none !important;
  }
}
</style>
