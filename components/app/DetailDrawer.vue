<script setup lang="ts">
import type { AppItem, AppVersion } from "~/composables/useApps";
import type { DocItem } from "~/composables/useDocs";
import type { DocSiteItem } from "~/composables/useDocSites";

export type AppDrawerTab = "docs" | "releases" | "sites";

const props = defineProps<{
  app: AppItem | null;
  tab: AppDrawerTab;
  canEdit?: boolean;
  canGenerateDocs?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "edit", app: AppItem): void;
  (e: "update:tab", tab: AppDrawerTab): void;
}>();

const tabs: { id: AppDrawerTab; label: string }[] = [
  { id: "docs", label: "Docs" },
  { id: "releases", label: "Releases" },
  { id: "sites", label: "Sites" },
];

const { versions, isLoading: isLoadingVersions, fetchVersions } = useVersions();
const { docs, isLoading: isLoadingDocs, fetchDocs } = useDocs();
const { docSites, isLoading: isLoadingSites, fetchDocSites } = useDocSites();

const appId = computed(() => props.app?.id ?? null);
const drawerRef = ref<HTMLElement | null>(null);

// Reset first so a previously opened app's rows never flash under the new header.
watch(
  appId,
  (id) => {
    versions.value = [];
    docs.value = [];
    docSites.value = [];
    if (!id) return;
    void Promise.all([fetchVersions(id), fetchDocs({ appId: id }), fetchDocSites({ appId: id })]);
  },
  { immediate: true }
);

onMounted(() => {
  nextTick(() => drawerRef.value?.focus());
});

const sortedDocs = computed(() =>
  [...docs.value].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  )
);

const stats = computed(() => ({
  versions: versions.value.length,
  latest: props.app?.latestVersion?.version ?? null,
  docs: docs.value.length,
  draftDocs: docs.value.filter((d) => d.status === "draft").length,
  sites: docSites.value.length,
}));

const panel = computed(() => {
  const id = appId.value ?? "";
  switch (props.tab) {
    case "docs":
      return {
        hint: "Filter by type and status on the Docs page.",
        link: `/docs?app=${id}`,
      };
    case "releases":
      return {
        hint: "Compare, archive, and edit changelogs on the Versions page.",
        link: `/versions?app=${id}`,
      };
    default:
      return {
        hint: "Manage navigation and publishing on the Doc Sites page.",
        link: "/sites",
      };
  }
});

function onTabKeydown(e: KeyboardEvent, index: number) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const delta = e.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(index + delta + tabs.length) % tabs.length]!;
  emit("update:tab", next.id);
  nextTick(() => document.getElementById(`app-drawer-tab-${next.id}`)?.focus());
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusText(status: string) {
  return status.replace(/_/g, " ").toUpperCase();
}

const appStatusClass: Record<AppItem["status"], string> = {
  active: "pill-green",
  draft: "pill-blue",
  maintenance: "pill-amber",
};

/** A version can have several releases (changelog, article); open the published one first. */
function releaseFor(v: AppVersion) {
  const list = v.releases ?? [];
  return list.find((r) => r.published) ?? list[0] ?? null;
}

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
</script>

<template>
  <Teleport to="body">
    <div class="drawer-scrim" @click.self="emit('close')">
      <aside
        ref="drawerRef"
        class="drawer"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="app ? `${app.name} details` : 'App details'"
      >
        <div v-if="!app" class="drawer__loading" aria-busy="true" aria-label="Loading app">
          <span class="sk-shimmer" style="width: 44px; height: 44px; border-radius: 12px" />
          <div class="drawer__loading-lines">
            <span class="sk-shimmer" style="width: 220px; height: 20px" />
            <span class="sk-shimmer" style="width: 320px; height: 14px" />
          </div>
        </div>

        <template v-else>
          <header class="drawer__head">
            <AppLogo :name="app.name" :logo-url="app.logoUrl" class="drawer__logo" />
            <div class="drawer__copy">
              <div class="drawer__title">
                <h2>{{ app.name }}</h2>
                <span class="pill" :class="appStatusClass[app.status] || 'pill-blue'">
                  {{ statusText(app.status) }}
                </span>
              </div>
              <p class="drawer__desc">{{ app.description || "No description yet." }}</p>
            </div>
            <div class="drawer__actions">
              <NuxtLink
                v-if="canGenerateDocs"
                :to="`/docs/generate/${app.id}`"
                class="drawer-btn drawer-btn--accent"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9.5 3 11 8l5 1.5L11 11l-1.5 5L8 11 3 9.5 8 8z" />
                  <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
                </svg>
                Generate Docs
              </NuxtLink>
              <button
                v-if="canEdit"
                type="button"
                class="drawer-btn"
                @click="emit('edit', app)"
              >
                Edit
              </button>
              <button
                type="button"
                class="drawer__close"
                aria-label="Close"
                @click="emit('close')"
              >
                <svg class="drawer__close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          <div class="drawer__stats" aria-label="App summary">
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

          <div class="drawer__body">
            <div class="tab-list" role="tablist" aria-label="App sections">
              <button
                v-for="(t, i) in tabs"
                :id="`app-drawer-tab-${t.id}`"
                :key="t.id"
                type="button"
                role="tab"
                class="tab"
                :class="{ 'is-active': tab === t.id }"
                :aria-selected="tab === t.id"
                :aria-controls="`app-drawer-panel-${t.id}`"
                :tabindex="tab === t.id ? 0 : -1"
                @click="emit('update:tab', t.id)"
                @keydown="onTabKeydown($event, i)"
              >
                {{ t.label }}
              </button>
            </div>

            <section
              :id="`app-drawer-panel-${tab}`"
              role="tabpanel"
              :aria-labelledby="`app-drawer-tab-${tab}`"
            >
              <div class="panel-head">
                <p class="panel-hint">{{ panel.hint }}</p>
                <NuxtLink :to="panel.link" class="open-link">
                  Open In Page
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                  </svg>
                </NuxtLink>
              </div>

              <!-- Docs -->
              <template v-if="tab === 'docs'">
                <p v-if="isLoadingDocs" class="state-text">Loading docs…</p>
                <p v-else-if="docs.length === 0" class="state-text">No docs yet.</p>
                <GeneralDataTable v-else :scrollable="true" class="drawer-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Author</th>
                      <th>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="doc in sortedDocs" :key="doc.id" class="is-link">
                      <td class="col-strong">
                        <NuxtLink :to="`/docs/${doc.id}`" class="row-link">{{ doc.title }}</NuxtLink>
                      </td>
                      <td>
                        <span class="pill" :class="docStatusClass[doc.status] || 'pill-blue'">
                          {{ statusText(doc.status) }}
                        </span>
                      </td>
                      <td class="col-num col-muted">{{ formatShortDate(doc.updatedAt) }}</td>
                      <td class="col-muted">{{ doc.author || "—" }}</td>
                      <td class="col-muted">{{ doc.createdBy || "—" }}</td>
                    </tr>
                  </tbody>
                </GeneralDataTable>
              </template>

              <!-- Releases (versions) -->
              <template v-else-if="tab === 'releases'">
                <p v-if="isLoadingVersions" class="state-text">Loading versions…</p>
                <p v-else-if="versions.length === 0" class="state-text">No versions yet.</p>
                <GeneralDataTable v-else :scrollable="true" class="drawer-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Author</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="v in versions" :key="v.id" :class="{ 'is-link': releaseFor(v) }">
                      <td class="col-num col-strong">
                        <NuxtLink
                          v-if="releaseFor(v)"
                          :to="`/releases/${releaseFor(v)!.id}`"
                          class="row-link"
                          :title="`Open release notes for v${v.version}`"
                        >
                          v{{ v.version }}
                        </NuxtLink>
                        <template v-else>v{{ v.version }}</template>
                      </td>
                      <td>
                        <span class="pill" :class="versionStatusClass[v.status] || 'pill-blue'">
                          {{ statusText(v.status) }}
                        </span>
                      </td>
                      <td class="col-muted">{{ v.createdBy || "—" }}</td>
                      <td class="col-num col-muted">{{ formatShortDate(v.releaseDate || v.createdAt) }}</td>
                    </tr>
                  </tbody>
                </GeneralDataTable>
              </template>

              <!-- Sites -->
              <template v-else>
                <p v-if="isLoadingSites" class="state-text">Loading doc sites…</p>
                <p v-else-if="docSites.length === 0" class="state-text">No doc site for this app yet.</p>
                <GeneralDataTable v-else :scrollable="true" class="drawer-table">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Status</th>
                      <th>Path</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="site in docSites" :key="site.id" class="is-link">
                      <td class="col-strong">
                        <NuxtLink :to="`/sites/${site.id}`" class="row-link">{{ site.name }}</NuxtLink>
                      </td>
                      <td>
                        <span class="pill" :class="siteStatusClass[site.status] || 'pill-blue'">
                          {{ statusText(site.status) }}
                        </span>
                      </td>
                      <td class="col-num col-muted">/wiki/{{ site.slug }}</td>
                      <td class="col-num col-muted">{{ formatShortDate(site.updatedAt) }}</td>
                    </tr>
                  </tbody>
                </GeneralDataTable>
              </template>
            </section>
          </div>
        </template>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-scrim {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  justify-content: flex-end;
  background: color-mix(in oklch, var(--fg) 25%, transparent);
  animation: scrimIn 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(951px, 100vw);
  height: 100%;
  background: var(--surface);
  border-radius: 12px 0 0 12px;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  overflow-y: auto;
  animation: drawerIn 0.25s cubic-bezier(0.25, 1, 0.5, 1);
}

.drawer:focus {
  outline: none;
}

@keyframes scrimIn {
  from {
    opacity: 0;
  }
}

@keyframes drawerIn {
  from {
    transform: translateX(32px);
    opacity: 0;
  }
}

.drawer__loading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 32px 28px;
}

.drawer__loading-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 44px 28px 26px;
}

.drawer__head .drawer__logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 13px;
  flex-shrink: 0;
}

.drawer__copy {
  flex: 1;
  min-width: 0;
}

.drawer__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.drawer__title h2 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg);
}

.drawer__desc {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.drawer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.drawer-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.drawer-btn:hover {
  border-color: var(--fg);
}

.drawer-btn--accent {
  border-color: var(--accent-strong);
  color: var(--accent-strong);
}

.drawer-btn--accent:hover {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.drawer-btn:focus-visible,
.drawer__close:focus-visible,
.open-link:focus-visible,
.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.drawer__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
}

.drawer__close:hover {
  background: var(--fg-soft);
}

.drawer__close-icon {
  color: var(--muted);
}

.drawer__close:hover .drawer__close-icon {
  color: var(--fg);
}

.drawer__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 24px;
  margin: 0 28px;
  padding: 0 0 16px;
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

.drawer__body {
  padding: 26px 28px 32px;
}

.tab-list {
  display: flex;
  gap: 4px;
  margin-bottom: 30px;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 10px 12px;
  margin-bottom: -1px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s ease-out, border-color 0.15s ease-out;
}

.tab:hover {
  color: var(--fg);
}

.tab.is-active {
  color: var(--fg);
  border-bottom-color: var(--accent-strong);
}

.tab:focus-visible {
  outline-offset: -2px;
  border-radius: 6px 6px 0 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 30px;
}

.panel-hint {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.open-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-strong);
  text-decoration: none;
  white-space: nowrap;
}

.open-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.state-text {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.drawer-table :deep(tbody tr.is-link:hover) {
  background: var(--accent-soft);
}

.row-link {
  color: inherit;
  text-decoration: none;
}

.row-link::after {
  content: "";
  position: absolute;
  inset: 0;
}

.row-link:focus-visible {
  outline: none;
}

.row-link:focus-visible::after {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 4px;
}

.drawer-table :deep(tbody tr.is-link) {
  position: relative;
  cursor: pointer;
}

.col-strong {
  font-weight: 500;
  color: var(--fg);
}

.col-muted {
  color: var(--muted);
}

.col-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
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

@media (max-width: 768px) {
  .drawer {
    border-radius: 0;
  }

  .drawer__head {
    flex-wrap: wrap;
  }

  .drawer__copy {
    flex-basis: calc(100% - 60px);
  }

  .drawer__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer,
  .drawer-scrim,
  .tab,
  .drawer-btn {
    animation: none !important;
    transition: none !important;
  }
}
</style>
