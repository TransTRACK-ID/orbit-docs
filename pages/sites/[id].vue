<script setup lang="ts">
import { toast } from "vue3-toastify";
import { usePageStore } from "~/store/page";
import type { NavConfig } from "~/server/database/schema";
import { slugify } from "~/utils/nav-client";

definePageMeta({
  auth: true,
  pageTransition: false,
});

const $page = usePageStore();
const route = useRoute();
const router = useRouter();

const siteId = computed(() => route.params.id as string);

const {
  currentSite,
  sitePages,
  isLoading,
  isSaving,
  fetchDocSite,
  fetchSitePages,
  updateDocSite,
  generateOpenApi,
  clearOpenApi,
} = useDocSites();
const { apps, fetchApps } = useApps();
const { docs: allDocs, fetchDocs, createDoc, updateDoc } = useDocs();

const form = reactive({
  name: "",
  slug: "",
  description: "",
  appId: "" as string,
  status: "draft" as "draft" | "published" | "archived",
});
const navConfig = ref<NavConfig>({ groups: [], pages: [], external: [] });
const openapiSpec = ref("");
const openapiFormat = ref<"json" | "yaml">("yaml");
const openapiGenerating = ref(false);
const openapiResult = ref<{ operationsCount: number; tags: string[] } | null>(null);
const slugError = ref("");
const nameError = ref(false);
const loaded = ref(false);
let prevName = "";

const newPageTitle = ref("");
const isCreatingPage = ref(false);
const showAddExisting = ref(false);
const addExistingSearch = ref("");
const addExistingAppFilter = ref("");
const selectedDocIds = ref<Set<string>>(new Set());
const isBindingPage = ref(false);
const isLoadingAddExisting = ref(false);

const addExistingAppOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
  { id: "__unbound__", label: "No app" },
]);

const filteredUnboundDocs = computed(() => {
  const q = addExistingSearch.value.trim().toLowerCase();
  return allDocs.value.filter((d) => {
    if (d.siteId) return false;
    if (addExistingAppFilter.value === "__unbound__" && d.appId) return false;
    if (
      addExistingAppFilter.value
      && addExistingAppFilter.value !== "__unbound__"
      && d.appId !== addExistingAppFilter.value
    ) {
      return false;
    }
    if (q && !d.title.toLowerCase().includes(q)) return false;
    return true;
  });
});

const selectedCount = computed(() => selectedDocIds.value.size);
const allVisibleSelected = computed(
  () =>
    filteredUnboundDocs.value.length > 0
    && filteredUnboundDocs.value.every((d) => selectedDocIds.value.has(d.id)),
);
const someVisibleSelected = computed(
  () => filteredUnboundDocs.value.some((d) => selectedDocIds.value.has(d.id)),
);

function uniquePageSlug(base: string): string {
  const taken = new Set(sitePages.value.map((p) => p.slug).filter(Boolean) as string[]);
  let slug = slugify(base) || "page";
  let i = 2;
  while (taken.has(slug)) {
    slug = `${slugify(base) || "page"}-${i++}`;
  }
  return slug;
}

function addSlugToNav(slug: string) {
  const pages = [...(navConfig.value.pages || [])];
  if (!pages.includes(slug)) pages.push(slug);
  navConfig.value = { ...navConfig.value, pages };
}

async function createPage() {
  const title = newPageTitle.value.trim();
  if (!title || isCreatingPage.value) return;
  isCreatingPage.value = true;
  try {
    const slug = uniquePageSlug(title);
    const doc = await createDoc({
      title,
      siteId: siteId.value,
      slug,
      appId: form.appId || null,
      status: "draft",
    });
    addSlugToNav(slug);
    await updateDocSite(siteId.value, { navConfig: navConfig.value });
    await fetchSitePages(siteId.value);
    newPageTitle.value = "";
    router.push(`/docs/${doc.id}`);
  } catch {
    // toast in composable
  } finally {
    isCreatingPage.value = false;
  }
}

function uniquePageSlugFromSet(base: string, taken: Set<string>): string {
  let slug = slugify(base) || "page";
  let i = 2;
  while (taken.has(slug)) {
    slug = `${slugify(base) || "page"}-${i++}`;
  }
  taken.add(slug);
  return slug;
}

async function bindExistingDocs(docsToBind: Array<{ id: string; title: string }>) {
  if (!docsToBind.length || isBindingPage.value) return;
  isBindingPage.value = true;
  try {
    const takenSlugs = new Set(
      sitePages.value.map((p) => p.slug).filter(Boolean) as string[],
    );
    for (const doc of docsToBind) {
      const slug = uniquePageSlugFromSet(doc.title, takenSlugs);
      await updateDoc(
        doc.id,
        {
          title: doc.title,
          siteId: siteId.value,
          slug,
        },
        { silent: true },
      );
      addSlugToNav(slug);
    }
    await updateDocSite(siteId.value, { navConfig: navConfig.value });
    await fetchSitePages(siteId.value);
    const count = docsToBind.length;
    toast.success(count === 1 ? "Doc added to site" : `${count} docs added to site`);
    closeAddExisting();
  } catch {
    // toast in composable
  } finally {
    isBindingPage.value = false;
  }
}

async function bindSelectedDocs() {
  const docsToBind = filteredUnboundDocs.value
    .filter((d) => selectedDocIds.value.has(d.id))
    .map((d) => ({ id: d.id, title: d.title }));
  await bindExistingDocs(docsToBind);
}

function toggleDocSelection(docId: string) {
  const next = new Set(selectedDocIds.value);
  if (next.has(docId)) next.delete(docId);
  else next.add(docId);
  selectedDocIds.value = next;
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    const visible = new Set(filteredUnboundDocs.value.map((d) => d.id));
    selectedDocIds.value = new Set(
      [...selectedDocIds.value].filter((id) => !visible.has(id)),
    );
    return;
  }
  selectedDocIds.value = new Set([
    ...selectedDocIds.value,
    ...filteredUnboundDocs.value.map((d) => d.id),
  ]);
}

function closeAddExisting() {
  showAddExisting.value = false;
  addExistingSearch.value = "";
  addExistingAppFilter.value = "";
  selectedDocIds.value = new Set();
}

async function loadAddExistingDocs() {
  isLoadingAddExisting.value = true;
  try {
    const appId =
      addExistingAppFilter.value && addExistingAppFilter.value !== "__unbound__"
        ? addExistingAppFilter.value
        : undefined;
    await fetchDocs(appId ? { appId } : undefined);
  } finally {
    isLoadingAddExisting.value = false;
  }
}

async function openAddExisting() {
  showAddExisting.value = true;
  addExistingSearch.value = "";
  addExistingAppFilter.value = form.appId || "";
  selectedDocIds.value = new Set();
  await loadAddExistingDocs();
}

watch(addExistingAppFilter, () => {
  if (!showAddExisting.value) return;
  selectedDocIds.value = new Set();
  void loadAddExistingDocs();
});

const appOptions = computed(() => [
  { id: "", label: "Unbound" },
  ...apps.value.map((a) => ({ id: a.id, label: a.name })),
]);

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

onMounted(async () => {
  $page.setTitle("Doc Site");
  await fetchApps();
  await loadSite();
});

async function loadSite() {
  loaded.value = false;
  try {
    const site = await fetchDocSite(siteId.value);
    if (site) {
      form.name = site.name;
      form.slug = site.slug;
      form.description = site.description || "";
      form.appId = site.appId || "";
      form.status = site.status;
      navConfig.value = site.navConfig || { groups: [], pages: [], external: [] };
      openapiSpec.value = site.openapiSpec || "";
      openapiFormat.value = site.openapiFormat || "yaml";
      openapiResult.value = site.openapiNormalized
        ? { operationsCount: site.openapiNormalized.operations.length, tags: site.openapiNormalized.tags }
        : null;
    }
  } catch {
    router.push("/sites");
  } finally {
    loaded.value = true;
  }
}

watch(() => form.name, (name) => {
  // Only auto-slug when slug is empty or still matches the slugified previous name
  if (!form.slug || form.slug === slugify(prevName)) {
    form.slug = slugify(name);
  }
  prevName = name;
});

async function save() {
  slugError.value = "";
  if (!form.name.trim()) {
    nameError.value = true;
    return;
  }
  nameError.value = false;
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    appId: form.appId || null,
    status: form.status,
    navConfig: navConfig.value,
  };
  try {
    await updateDocSite(siteId.value, payload);
  } catch (e: any) {
    if (e?.statusCode === 409) {
      slugError.value = "That slug is already in use.";
    }
  }
}

const publicUrl = computed(() => `/s/${form.slug}`);

const hasApiReference = computed(
  () =>
    !!openapiResult.value
    || !!(navConfig.value.openapi && navConfig.value.openapi.length)
    || !!openapiSpec.value.trim(),
);

async function generateOpenApiSite() {
  if (!openapiSpec.value.trim()) {
    toast.error("Paste an OpenAPI spec first");
    return;
  }
  openapiGenerating.value = true;
  try {
    const res = await generateOpenApi(siteId.value, openapiSpec.value, openapiFormat.value);
    openapiResult.value = { operationsCount: res.operationsCount, tags: res.tags };
    navConfig.value = res.navConfig;
  } catch {
    // toast handled in composable
  } finally {
    openapiGenerating.value = false;
  }
}

async function removeApiReference() {
  if (openapiGenerating.value || isSaving.value) return;
  openapiGenerating.value = true;
  try {
    const updated = await clearOpenApi(siteId.value);
    openapiSpec.value = "";
    openapiResult.value = null;
    navConfig.value = updated.navConfig || { groups: [], pages: [], external: [], openapi: [] };
  } catch {
    // toast handled in composable
  } finally {
    openapiGenerating.value = false;
  }
}

function onSpecFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    openapiSpec.value = String(reader.result || "");
    openapiFormat.value = file.name.endsWith(".json") ? "json" : "yaml";
  };
  reader.readAsText(file);
}
</script>

<template>
  <div class="site-editor">
    <header class="topbar">
      <div class="flex-gap-md">
        <button type="button" class="btn btn-ghost" @click="router.push('/sites')">← Sites</button>
        <h1>{{ currentSite?.name || 'Doc Site' }}</h1>
      </div>
      <div class="flex-gap-sm">
        <NuxtLink
          v-if="currentSite && currentSite.status === 'published' && form.slug"
          :to="publicUrl"
          target="_blank"
          class="btn btn-ghost"
        >
          Public View
        </NuxtLink>
        <button type="button" class="btn btn-primary" :disabled="isSaving" @click="save">
          <span v-if="isSaving">Saving…</span>
          <span v-else>Save</span>
        </button>
      </div>
    </header>

    <div v-if="isLoading && !loaded" class="loading">Loading…</div>

    <div v-else class="editor-grid">
      <div class="main-col">
        <section class="card">
          <h2 class="card-title">Details</h2>
          <div class="form-group">
            <label for="name">Name</label>
            <input id="name" v-model="form.name" class="input" :class="{ 'input-error': nameError }" />
          </div>
          <div class="form-group">
            <label for="slug">Slug</label>
            <input id="slug" v-model="form.slug" class="input" />
            <span v-if="slugError" class="field-error">{{ slugError }}</span>
            <span v-else class="field-hint">Public URL: /s/{{ form.slug || '…' }}</span>
          </div>
          <div class="form-group">
            <label for="desc">Description</label>
            <input id="desc" v-model="form.description" class="input" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="app">App</label>
              <select id="app" v-model="form.appId" class="select">
                <option v-for="o in appOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" v-model="form.status" class="select">
                <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Navigation tree</h2>
          <p class="card-desc">
            Arrange pages and groups for the site sidebar. Create pages below or pick existing docs to add to this site.
          </p>
          <NavTreeEditor v-model="navConfig" :pages="sitePages" />
        </section>

        <section class="card">
          <h2 class="card-title">OpenAPI reference</h2>
          <p class="card-desc">
            Paste an OpenAPI 3 spec (JSON or YAML). Generating replaces the OpenAPI section of the navigation tree with
            one entry per operation, grouped by tag.
          </p>
          <div class="form-row">
            <div class="form-group">
              <label for="oa-format">Format</label>
              <select id="oa-format" v-model="openapiFormat" class="select">
                <option value="yaml">YAML</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div class="form-group">
              <label for="oa-file">Upload spec file</label>
              <input id="oa-file" type="file" accept=".json,.yaml,.yml" class="input" @change="onSpecFile" />
            </div>
          </div>
          <div class="form-group">
            <label for="oa-spec">Spec</label>
            <textarea
              id="oa-spec"
              v-model="openapiSpec"
              class="input spec-textarea"
              placeholder="openapi: 3.0.0&#10;info:&#10;  title: My API&#10;paths:&#10;  /example:&#10;    get:&#10;      operationId: getExample&#10;      responses:&#10;        '200':&#10;          description: ok"
            ></textarea>
          </div>
          <div class="oa-actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="openapiGenerating || !openapiSpec.trim()"
              @click="generateOpenApiSite"
            >
              <span v-if="openapiGenerating">Generating…</span>
              <span v-else>Generate API site</span>
            </button>
            <button
              v-if="hasApiReference"
              type="button"
              class="btn btn-secondary"
              :disabled="openapiGenerating || isSaving"
              @click="removeApiReference"
            >
              Remove API reference
            </button>
            <span v-if="openapiResult" class="oa-result">
              {{ openapiResult.operationsCount }} operations
              <span v-if="openapiResult.tags.length"> · tags: {{ openapiResult.tags.join(", ") }}</span>
            </span>
          </div>
        </section>
      </div>

      <aside class="side-col">
        <section class="card">
          <div class="pages-card-header">
            <h2 class="card-title">Pages</h2>
            <NuxtLink :to="`/docs?siteId=${siteId}`" class="btn btn-ghost btn-sm">
              All docs
            </NuxtLink>
          </div>

          <div class="new-page-form">
            <input
              v-model="newPageTitle"
              class="input"
              placeholder="New page title…"
              @keydown.enter.prevent="createPage"
            />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!newPageTitle.trim() || isCreatingPage"
              @click="createPage"
            >
              {{ isCreatingPage ? "Creating…" : "+ New page" }}
            </button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm pages-add-existing" @click="openAddExisting">
            Add existing doc
          </button>

          <div v-if="sitePages.length === 0" class="empty-small">
            No pages yet. Create a page above or add an existing doc.
          </div>
          <ul v-else class="page-list">
            <li v-for="p in sitePages" :key="p.id" class="page-item">
              <NuxtLink :to="`/docs/${p.id}`" class="page-link">
                <span class="page-title">{{ p.title }}</span>
                <span class="page-slug num">{{ p.slug || "no slug" }}</span>
              </NuxtLink>
              <span class="pill" :class="p.status === 'published' ? 'pill-green' : 'pill-blue'">
                {{ p.status }}
              </span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <!-- Add existing doc modal -->
    <div v-if="showAddExisting" class="modal-overlay" @click="closeAddExisting">
      <div class="modal-dialog modal-dialog--add-docs" role="dialog" aria-labelledby="add-docs-title" @click.stop>
        <div class="modal-header">
          <h3 id="add-docs-title">Add existing docs</h3>
          <p class="modal-desc">
            Select unassigned docs to bind to this site. Each gets a page slug and is added to the nav.
          </p>
        </div>

        <div class="bind-doc-toolbar">
          <input
            v-model="addExistingSearch"
            class="input bind-doc-search"
            placeholder="Search by title…"
            aria-label="Search docs to add"
          />
          <select v-model="addExistingAppFilter" class="select bind-doc-app-filter" aria-label="Filter by app">
            <option v-for="o in addExistingAppOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
        </div>

        <div v-if="filteredUnboundDocs.length" class="bind-doc-selection-bar">
          <label class="bind-doc-select-all">
            <input
              type="checkbox"
              class="bind-doc-checkbox"
              :checked="allVisibleSelected"
              :indeterminate="someVisibleSelected && !allVisibleSelected"
              @change="toggleSelectAllVisible"
            />
            <span>Select all ({{ filteredUnboundDocs.length }})</span>
          </label>
          <span v-if="selectedCount" class="bind-doc-selected-count num">{{ selectedCount }} selected</span>
        </div>

        <div v-if="isLoadingAddExisting" class="bind-doc-loading">Loading docs…</div>
        <ul v-else-if="filteredUnboundDocs.length" class="bind-doc-list">
          <li v-for="doc in filteredUnboundDocs" :key="doc.id">
            <label class="bind-doc-item" :class="{ 'is-selected': selectedDocIds.has(doc.id) }">
              <input
                type="checkbox"
                class="bind-doc-checkbox"
                :checked="selectedDocIds.has(doc.id)"
                @change="toggleDocSelection(doc.id)"
              />
              <span class="bind-doc-info">
                <span class="bind-doc-title">{{ doc.title }}</span>
                <span class="bind-doc-meta">
                  {{ doc.status }} · {{ doc.app?.name || "No app" }}
                </span>
              </span>
            </label>
          </li>
        </ul>
        <p v-else class="empty-small bind-doc-empty">No unassigned docs match your filters.</p>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="closeAddExisting">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!selectedCount || isBindingPage"
            @click="bindSelectedDocs"
          >
            <span v-if="isBindingPage">Adding…</span>
            <span v-else>Add selected{{ selectedCount ? ` (${selectedCount})` : "" }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
