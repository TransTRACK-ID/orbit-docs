<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { AppItem, AppVersion } from "~/composables/useApps";
import type { DocItem } from "~/composables/useDocs";
import type { DocSiteItem } from "~/composables/useDocSites";
import type { ReleaseItem } from "~/types";
import { formatReleaseHeading } from "~/utils/functions";

definePageMeta({
  auth: true,
});

type TabId = "overview" | "versions" | "docs" | "releases" | "sites";

const route = useRoute();
const router = useRouter();
const $page = usePageStore();
const { can } = usePermissions();

const appId = computed(() => route.params.id as string);

const canEditApp = computed(() => can("apps:write"));
const canDeleteApp = computed(() => can("apps:delete"));
const canGenerateDocs = computed(() => can("doc_generation:run"));
const canWriteVersions = computed(() => can("versions:write"));
const canWriteDocs = computed(() => can("docs:write"));
const canOpenMenu = computed(() => canGenerateDocs.value || canDeleteApp.value);

const { fetchApp } = useApps();
const { versions, isLoading: isLoadingVersions, fetchVersions } = useVersions();
const { docs, isLoading: isLoadingDocs, fetchDocs } = useDocs();
const { releases, isLoading: isLoadingReleases, fetchReleases } = useReleases();
const { docSites, isLoading: isLoadingSites, fetchDocSites } = useDocSites();

const app = ref<AppItem | null>(null);
const isLoadingApp = ref(true);

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "versions", label: "Versions" },
  { id: "docs", label: "Docs" },
  { id: "releases", label: "Releases" },
  { id: "sites", label: "Sites" },
];

const activeTab = computed<TabId>(() => {
  const tab = route.query.tab as TabId | undefined;
  return tabs.some((t) => t.id === tab) ? tab! : "overview";
});

function selectTab(id: TabId) {
  const { tab: _tab, ...rest } = route.query;
  router.replace({ query: id === "overview" ? rest : { ...rest, tab: id } });
}

function onTabKeydown(e: KeyboardEvent, index: number) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const delta = e.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(index + delta + tabs.length) % tabs.length]!;
  selectTab(next.id);
  nextTick(() => document.getElementById(`app-tab-${next.id}`)?.focus());
}

async function load() {
  isLoadingApp.value = true;
  try {
    app.value = await fetchApp(appId.value);
  } catch (e: any) {
    if (e?.statusCode === 404) {
      showError({ statusCode: 404, statusMessage: "App not found" });
    }
    return;
  } finally {
    isLoadingApp.value = false;
  }
  if (!app.value) return;
  $page.setTitle(app.value.name);
  await Promise.all([
    fetchVersions(appId.value),
    fetchDocs({ appId: appId.value }),
    fetchReleases({ app: app.value.name }),
    fetchDocSites({ appId: appId.value }),
  ]);
}

onMounted(() => {
  load();
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});

const isMenuOpen = ref(false);

function onDocClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest(".actions-menu")) isMenuOpen.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") isMenuOpen.value = false;
}

const sortedDocs = computed(() =>
  [...docs.value].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  )
);

const stats = computed(() => ({
  versions: versions.value.length,
  latest: app.value?.latestVersion?.version ?? null,
  docs: docs.value.length,
  draftDocs: docs.value.filter((d) => d.status === "draft").length,
  sites: docSites.value.length,
}));

const versionsLink = computed(() => `/versions?app=${appId.value}`);
const docsLink = computed(() => `/docs?app=${appId.value}`);
const releasesLink = computed(() =>
  app.value ? `/releases?app=${encodeURIComponent(app.value.name)}` : "/releases"
);

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const appStatusClass: Record<AppItem["status"], string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

const versionStatusClass: Record<AppVersion["status"], string> = {
  published: "pill-green",
  draft: "pill-blue",
  rc: "pill-amber",
  archived: "pill-muted",
};

const docStatusClass: Record<DocItem["status"], string> = {
  draft: "pill-blue",
  in_review: "pill-amber",
  published: "pill-green",
  archived: "pill-muted",
};

const siteStatusClass: Record<DocSiteItem["status"], string> = {
  draft: "pill-blue",
  published: "pill-green",
  archived: "pill-muted",
};

function statusText(status: string) {
  return status.replace(/_/g, " ").toUpperCase();
}

function releaseTitle(r: ReleaseItem) {
  return formatReleaseHeading(r.appName, r.version, r.heroTitle);
}
</script>

<template>
  <div class="app-detail">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <NuxtLink to="/apps">Apps</NuxtLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ app?.name || "…" }}</span>
    </nav>

    <div v-if="isLoadingApp" class="detail-skeleton" aria-busy="true" aria-label="Loading app">
      <span class="sk-shimmer" style="width: 48px; height: 48px; border-radius: 12px;" />
      <div class="detail-skeleton__lines">
        <span class="sk-shimmer" style="width: 220px; height: 20px;" />
        <span class="sk-shimmer" style="width: 360px; height: 14px;" />
      </div>
    </div>

    <template v-else-if="app">
      <header class="page-masthead">
        <div class="app-identity">
          <AppLogo :name="app.name" :logo-url="app.logoUrl" class="app-identity__logo" />
          <div class="page-masthead__copy">
            <div class="app-identity__title">
              <h1>{{ app.name }}</h1>
              <span class="pill" :class="appStatusClass[app.status] || 'pill-blue'">
                {{ statusText(app.status) }}
              </span>
            </div>
            <p class="page-subtitle">
              <template v-if="app.description">{{ app.description }}</template>
              <template v-else>No description yet.</template>
            </p>
            <p v-if="app.owner" class="app-identity__owner">Owner · {{ app.owner }}</p>
          </div>
        </div>
        <div class="page-masthead__actions">
          <NuxtLink
            v-if="canEditApp"
            :to="`/apps?edit=${app.id}`"
            class="btn btn-secondary"
          >
            Edit
          </NuxtLink>
          <div v-if="canOpenMenu" class="action-dropdown-wrap actions-menu">
            <button
              type="button"
              class="btn btn-ghost row-action--icon"
              aria-label="More actions"
              aria-haspopup="menu"
              :aria-expanded="isMenuOpen"
              @click.stop="isMenuOpen = !isMenuOpen"
            >
              <IconsDotsVertical size="16" />
            </button>
            <div v-if="isMenuOpen" class="dropdown-menu" role="menu" @click.stop>
              <NuxtLink
                v-if="canGenerateDocs"
                :to="`/docs/generate/${app.id}`"
                class="dropdown-item"
                role="menuitem"
              >
                Generate Docs
              </NuxtLink>
              <NuxtLink
                v-if="canDeleteApp"
                :to="`/apps?delete=${app.id}`"
                class="dropdown-item dropdown-item--danger"
                role="menuitem"
              >
                <IconsTrash size="14" />
                Delete app
              </NuxtLink>
            </div>
          </div>
        </div>
      </header>

      <div class="stats-bar" aria-label="App summary">
        <div class="stat">
          <span class="stat-num num">{{ stats.versions }}</span>
          <span class="stat-label">{{ stats.versions === 1 ? "Version" : "Versions" }}</span>
        </div>
        <div class="stat">
          <span class="stat-num num">{{ stats.latest ? `v${stats.latest}` : "—" }}</span>
          <span class="stat-label">Latest</span>
        </div>
        <div class="stat">
          <span class="stat-num num">{{ stats.docs }}</span>
          <span class="stat-label">{{ stats.docs === 1 ? "Doc" : "Docs" }}</span>
        </div>
        <div class="stat">
          <span class="stat-num num">{{ stats.draftDocs }}</span>
          <span class="stat-label">Draft docs</span>
        </div>
        <div class="stat">
          <span class="stat-num num">{{ stats.sites }}</span>
          <span class="stat-label">{{ stats.sites === 1 ? "Doc site" : "Doc sites" }}</span>
        </div>
      </div>

      <div class="tab-list" role="tablist" aria-label="App sections">
        <button
          v-for="(tab, i) in tabs"
          :id="`app-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`app-panel-${tab.id}`"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="selectTab(tab.id)"
          @keydown="onTabKeydown($event, i)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Overview -->
      <section
        v-if="activeTab === 'overview'"
        id="app-panel-overview"
        role="tabpanel"
        aria-labelledby="app-tab-overview"
        class="overview-grid"
      >
        <div class="overview-block">
          <div class="block-head">
            <h2>Latest versions</h2>
            <button v-if="versions.length > 5" type="button" class="link-btn" @click="selectTab('versions')">
              View all
            </button>
          </div>
          <p v-if="isLoadingVersions" class="block-muted">Loading versions…</p>
          <div v-else-if="versions.length === 0" class="block-empty">
            <p>No versions yet. Versions anchor changelogs and releases for this app.</p>
            <NuxtLink v-if="canWriteVersions" :to="versionsLink" class="btn btn-secondary btn-sm">
              + New Version
            </NuxtLink>
          </div>
          <ul v-else class="row-list" role="list">
            <li v-for="v in versions.slice(0, 5)" :key="v.id" class="row-list__item">
              <span class="num col-strong">v{{ v.version }}</span>
              <span class="pill" :class="versionStatusClass[v.status] || 'pill-blue'">{{ statusText(v.status) }}</span>
              <span class="row-list__meta num">{{ formatShortDate(v.releaseDate || v.createdAt) }}</span>
            </li>
          </ul>
        </div>

        <div class="overview-block">
          <div class="block-head">
            <h2>Recently edited docs</h2>
            <button v-if="docs.length > 5" type="button" class="link-btn" @click="selectTab('docs')">
              View all
            </button>
          </div>
          <p v-if="isLoadingDocs" class="block-muted">Loading docs…</p>
          <div v-else-if="docs.length === 0" class="block-empty">
            <p>No docs yet. Write one, or generate docs from the app's repository.</p>
            <NuxtLink v-if="canWriteDocs" :to="docsLink" class="btn btn-secondary btn-sm">
              + New Doc
            </NuxtLink>
          </div>
          <ul v-else class="row-list" role="list">
            <li v-for="doc in sortedDocs.slice(0, 5)" :key="doc.id" class="row-list__item">
              <NuxtLink :to="`/docs/${doc.id}`" class="row-list__title">{{ doc.title }}</NuxtLink>
              <span class="pill" :class="docStatusClass[doc.status] || 'pill-blue'">{{ statusText(doc.status) }}</span>
              <span class="row-list__meta num">{{ formatShortDate(doc.updatedAt) }}</span>
            </li>
          </ul>
        </div>

        <div class="overview-block">
          <div class="block-head">
            <h2>Latest release</h2>
            <button v-if="releases.length > 1" type="button" class="link-btn" @click="selectTab('releases')">
              View all
            </button>
          </div>
          <p v-if="isLoadingReleases" class="block-muted">Loading releases…</p>
          <div v-else-if="releases.length === 0" class="block-empty">
            <p>No releases yet. Publish a changelog or article from a version.</p>
          </div>
          <NuxtLink v-else :to="`/releases/${releases[0]!.id}`" class="release-row">
            <span class="row-list__title">{{ releaseTitle(releases[0]!) }}</span>
            <span class="pill" :class="releases[0]!.published ? 'pill-green' : 'pill-blue'">
              {{ releases[0]!.published ? "PUBLISHED" : "DRAFT" }}
            </span>
            <span class="row-list__meta num">{{ formatShortDate(releases[0]!.releaseDate || releases[0]!.createdAt) }}</span>
          </NuxtLink>
        </div>

        <div class="overview-block">
          <div class="block-head">
            <h2>Doc sites</h2>
            <button v-if="docSites.length > 3" type="button" class="link-btn" @click="selectTab('sites')">
              View all
            </button>
          </div>
          <p v-if="isLoadingSites" class="block-muted">Loading doc sites…</p>
          <div v-else-if="docSites.length === 0" class="block-empty">
            <p>No doc site yet. A doc site publishes this app's docs as a browsable wiki.</p>
          </div>
          <ul v-else class="row-list" role="list">
            <li v-for="site in docSites.slice(0, 3)" :key="site.id" class="row-list__item">
              <NuxtLink :to="`/sites/${site.id}`" class="row-list__title">{{ site.name }}</NuxtLink>
              <span class="pill" :class="siteStatusClass[site.status] || 'pill-blue'">{{ statusText(site.status) }}</span>
              <span class="row-list__meta num">/{{ site.slug }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Versions -->
      <section
        v-else-if="activeTab === 'versions'"
        id="app-panel-versions"
        role="tabpanel"
        aria-labelledby="app-tab-versions"
      >
        <div class="panel-head">
          <p class="block-muted">Compare, archive, and edit changelogs on the Versions page.</p>
          <NuxtLink :to="versionsLink" class="btn btn-secondary btn-sm">Open in Versions →</NuxtLink>
        </div>
        <p v-if="isLoadingVersions" class="block-muted">Loading versions…</p>
        <div v-else-if="versions.length === 0" class="empty-state">
          <p>No versions yet.</p>
        </div>
        <GeneralDataTable v-else :scrollable="true">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Author</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in versions" :key="v.id">
              <td class="col-num col-strong">v{{ v.version }}</td>
              <td><span class="pill" :class="versionStatusClass[v.status] || 'pill-blue'">{{ statusText(v.status) }}</span></td>
              <td class="col-muted">{{ v.createdBy || "—" }}</td>
              <td class="col-num col-muted">{{ formatShortDate(v.releaseDate || v.createdAt) }}</td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </section>

      <!-- Docs -->
      <section
        v-else-if="activeTab === 'docs'"
        id="app-panel-docs"
        role="tabpanel"
        aria-labelledby="app-tab-docs"
      >
        <div class="panel-head">
          <p class="block-muted">Filter by type and status on the Docs page.</p>
          <NuxtLink :to="docsLink" class="btn btn-secondary btn-sm">Open in Docs →</NuxtLink>
        </div>
        <p v-if="isLoadingDocs" class="block-muted">Loading docs…</p>
        <div v-else-if="docs.length === 0" class="empty-state">
          <p>No docs yet.</p>
        </div>
        <GeneralDataTable v-else :scrollable="true">
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
            <tr v-for="doc in sortedDocs" :key="doc.id">
              <td class="col-strong">{{ doc.title }}</td>
              <td><span class="pill" :class="docStatusClass[doc.status] || 'pill-blue'">{{ statusText(doc.status) }}</span></td>
              <td class="col-num col-muted">{{ formatShortDate(doc.updatedAt) }}</td>
              <td class="col-muted">{{ doc.author || "—" }}</td>
              <td class="col-actions">
                <NuxtLink :to="`/docs/${doc.id}`" class="btn btn-ghost btn-sm">Open</NuxtLink>
              </td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </section>

      <!-- Releases -->
      <section
        v-else-if="activeTab === 'releases'"
        id="app-panel-releases"
        role="tabpanel"
        aria-labelledby="app-tab-releases"
      >
        <div class="panel-head">
          <p class="block-muted">Read and share releases on the Releases page.</p>
          <NuxtLink :to="releasesLink" class="btn btn-secondary btn-sm">Open in Releases →</NuxtLink>
        </div>
        <p v-if="isLoadingReleases" class="block-muted">Loading releases…</p>
        <div v-else-if="releases.length === 0" class="empty-state">
          <p>No releases yet.</p>
        </div>
        <GeneralDataTable v-else :scrollable="true">
          <thead>
            <tr>
              <th>Release</th>
              <th>Status</th>
              <th>Type</th>
              <th>Date</th>
              <th class="col-actions" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in releases" :key="r.id">
              <td class="col-strong">{{ releaseTitle(r) }}</td>
              <td>
                <span class="pill" :class="r.published ? 'pill-green' : 'pill-blue'">
                  {{ r.published ? "PUBLISHED" : "DRAFT" }}
                </span>
              </td>
              <td class="col-muted">{{ r.type === "article" ? "Article" : "Changelog" }}</td>
              <td class="col-num col-muted">{{ formatShortDate(r.releaseDate || r.createdAt) }}</td>
              <td class="col-actions">
                <NuxtLink :to="`/releases/${r.id}`" class="btn btn-ghost btn-sm">Open</NuxtLink>
              </td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </section>

      <!-- Sites -->
      <section
        v-else
        id="app-panel-sites"
        role="tabpanel"
        aria-labelledby="app-tab-sites"
      >
        <div class="panel-head">
          <p class="block-muted">Manage navigation and publishing on the Doc Sites page.</p>
          <NuxtLink to="/sites" class="btn btn-secondary btn-sm">Open in Doc Sites →</NuxtLink>
        </div>
        <p v-if="isLoadingSites" class="block-muted">Loading doc sites…</p>
        <div v-else-if="docSites.length === 0" class="empty-state">
          <p>No doc site for this app yet.</p>
        </div>
        <GeneralDataTable v-else :scrollable="true">
          <thead>
            <tr>
              <th>Site</th>
              <th>Status</th>
              <th>Path</th>
              <th>Updated</th>
              <th class="col-actions" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="site in docSites" :key="site.id">
              <td class="col-strong">{{ site.name }}</td>
              <td><span class="pill" :class="siteStatusClass[site.status] || 'pill-blue'">{{ statusText(site.status) }}</span></td>
              <td class="col-num col-muted">/wiki/{{ site.slug }}</td>
              <td class="col-num col-muted">{{ formatShortDate(site.updatedAt) }}</td>
              <td class="col-actions">
                <NuxtLink :to="`/sites/${site.id}`" class="btn btn-ghost btn-sm">Manage</NuxtLink>
              </td>
            </tr>
          </tbody>
        </GeneralDataTable>
      </section>
    </template>
  </div>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--muted);
}

.breadcrumb a {
  color: var(--muted);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--fg);
}

.breadcrumb [aria-current="page"] {
  color: var(--fg);
}

.detail-skeleton {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}

.detail-skeleton__lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.page-subtitle {
  margin: 4px 0 0;
  max-width: 65ch;
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

.app-identity {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}

.app-identity .app-identity__logo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg, 12px);
  font-size: 14px;
}

.app-identity__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-identity__owner {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.action-dropdown-wrap {
  position: relative;
}

.row-action--icon {
  padding: 8px;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 180px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 10%, transparent);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--fg);
  text-decoration: none;
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

.stats-bar {
  display: flex;
  gap: 24px;
  align-items: baseline;
  flex-wrap: wrap;
  margin-bottom: 16px;
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

.tab-list {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 8px 12px;
  margin-bottom: -1px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: color 150ms ease-out, border-color 150ms ease-out;
}

.tab:hover {
  color: var(--fg);
}

.tab.is-active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}

.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px 6px 0 0;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px 40px;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.block-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}

.link-btn {
  border: 0;
  background: none;
  padding: 0;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}

.link-btn:hover {
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.block-muted {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.block-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
}

.block-empty p {
  margin: 0;
  max-width: 48ch;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.row-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row-list__item,
.release-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 104px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.release-row {
  color: inherit;
  text-decoration: none;
}

.release-row:hover .row-list__title {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.row-list__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--fg);
  text-decoration: none;
}

a.row-list__title:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.row-list__item .pill,
.release-row .pill {
  justify-self: start;
}

.row-list__meta {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.pill {
  display: inline-flex;
  align-items: center;
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

.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.col-strong {
  font-weight: 500;
  color: var(--fg);
}

.col-muted {
  color: var(--muted);
}

.col-actions {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-masthead,
  .panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .tab-list {
    overflow-x: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab {
    transition: none;
  }
}
</style>
