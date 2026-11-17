<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { formatDisplayVersion, formatReleaseHeading } from "~/utils/functions";
import type { ReleaseItem } from "~/composables/useReleases";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { can } = usePermissions();

const canWriteChangelogs = computed(() => can("changelogs:write"));
const canWriteReleases = computed(() => can("releases:write"));

onBeforeMount(() => {
  $page.setTitle("Releases");
});

const route = useRoute();
const router = useRouter();
const { apps, fetchApps } = useApps();
const { releases, isLoading, fetchReleases } = useReleases();

const searchQuery = ref("");
const initialApp = typeof route.query.app === "string" ? route.query.app : "";
const selectedApps = ref<string[]>(initialApp ? [initialApp] : []);
const statusFilter = ref("");
// Exactly one selected app, else "" (server-side scoping, share scope).
const appFilter = computed(() => (selectedApps.value.length === 1 ? selectedApps.value[0]! : ""));

watch(
  () => route.query.app,
  (app) => {
    const name = typeof app === "string" ? app : "";
    if (name !== appFilter.value) selectedApps.value = name ? [name] : [];
  },
);

onMounted(async () => {
  await fetchApps();
  await fetchReleases({
    search: searchQuery.value,
    app: appFilter.value,
  });
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
});

watch([searchQuery, appFilter], async () => {
  await fetchReleases({
    search: searchQuery.value,
    app: appFilter.value,
  });
});

const filteredReleases = computed(() => {
  let list = [...releases.value];
  if (selectedApps.value.length > 1) {
    const names = new Set(selectedApps.value);
    list = list.filter((r) => names.has(r.appName));
  }
  if (statusFilter.value) {
    const wantPublished = statusFilter.value === "published";
    list = list.filter((r) => r.published === wantPublished);
  }
  return list.sort((a, b) => {
    const dA = new Date(a.releaseDate || a.createdAt || 0).getTime();
    const dB = new Date(b.releaseDate || b.createdAt || 0).getTime();
    return dB - dA;
  });
});

// The API filters by app name; ids here are names too.
const appFilterOptions = computed(() =>
  apps.value.map((a) => ({ id: a.name, label: a.name })),
);

const statusFilterOptions = [
  { id: "", label: "All Status" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
];

function formatTimelineDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function countCategories(categories: ReleaseItem["categories"]) {
  return {
    added: categories?.added || [],
    fixed: categories?.fixed || [],
    changed: categories?.changed || [],
    deprecated: categories?.deprecated || [],
    security: categories?.security || [],
  };
}

const publishPillClass = (published: boolean) => (published ? "pill-green" : "pill-blue");

const publishLabel = (published: boolean) => (published ? "PUBLISHED" : "DRAFT");

const typeLabel = (type: ReleaseItem["type"]) =>
  type === "article" ? "ARTICLE" : "CHANGELOG";

function getSummaryBlurb(summary: string | null): string {
  if (!summary?.trim()) return "";
  const body = summary.replace(/^---[\s\S]*?---\n?/, "").trim();
  const intro = body.split(/^#{1,3}\s/m)[0].trim();
  const text = intro.replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
  if (!text) return "";
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

function getCollapsedPreview(r: ReleaseItem): string {
  const blurb = getSummaryBlurb(r.summary);
  if (blurb) return blurb;
  if (r.type === "normal" && r.categories) {
    const cats = countCategories(r.categories);
    const total = Object.values(cats).reduce((sum, items) => sum + items.length, 0);
    if (total > 0) {
      return `${total} ${total === 1 ? "change" : "changes"} in ${formatDisplayVersion(r.version)}.`;
    }
  }
  return r.version
    ? `Release ${formatDisplayVersion(r.version)} for ${r.appName}.`
    : `Release for ${r.appName}.`;
}

// Release preview drawer, deep-linkable via ?release=<id>
const previewId = computed(() => {
  const id = route.query.release;
  return typeof id === "string" && id ? id : null;
});

const previewRelease = computed(
  () => (previewId.value ? releases.value.find((r) => r.id === previewId.value) ?? null : null),
);

function previewLink(r: ReleaseItem) {
  return { query: { ...route.query, release: r.id } };
}

function closePreview() {
  const { release: _release, ...rest } = route.query;
  router.replace({ query: rest });
}

// Unknown or filtered-out release id: drop the drawer once the list has loaded.
watch([isLoading, releases, previewId], () => {
  if (!isLoading.value && previewId.value && !previewRelease.value) closePreview();
});

function editReleaseLink(r: ReleaseItem): string | null {
  if (r.type === "normal" && r.versionId && canWriteChangelogs.value) {
    return `/changelogs?versionId=${r.versionId}`;
  }
  if (canWriteReleases.value) return `/releases/${r.id}?edit=1`;
  return null;
}

function editReleaseLabel(r: ReleaseItem): string {
  if (r.type === "normal" && r.versionId && canWriteChangelogs.value) {
    return "Edit changelog";
  }
  return "Edit release";
}

// ── Notion import dialog ───────────────────────────────────────
const showImportModal = ref(false);

function openImportModal() {
  showImportModal.value = true;
}

function closeImportModal() {
  showImportModal.value = false;
}

async function onReleaseImported(r: ReleaseItem) {
  showImportModal.value = false;
  await fetchReleases({
    search: searchQuery.value,
    app: appFilter.value,
  });
  await navigateTo(`/releases/${r.id}`);
}

// ── Share modal ────────────────────────────────────────────────
const showShareModal = ref(false);
const shareApp = ref("");
const shareEmbed = ref(false);

const shareUrl = computed(() => {
  const base = `${window.location.origin}/p/releases`;
  const params = new URLSearchParams();
  if (shareApp.value) params.set("app", shareApp.value);
  if (shareEmbed.value) params.set("embed", "1");
  const q = params.toString();
  return q ? `${base}?${q}` : base;
});

const shareAppOptions = computed(() => [
  { id: "", label: "All apps" },
  ...apps.value.map((a) => ({ id: a.name, label: a.name })),
]);

function openShareModal() {
  shareApp.value = appFilter.value;
  shareEmbed.value = false;
  showShareModal.value = true;
}

function closeShareModal() {
  showShareModal.value = false;
}

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    alert("Public link copied");
    closeShareModal();
  } catch {
    const input = document.createElement("input");
    input.value = shareUrl.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    alert("Public link copied");
    closeShareModal();
  }
}

function onKeydown(e: KeyboardEvent) {
  // A dropdown that handled Esc itself calls preventDefault; leave the rest alone.
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (showImportModal.value) {
    closeImportModal();
  } else if (showShareModal.value) {
    closeShareModal();
  } else if (previewId.value) {
    closePreview();
  } else {
    searchQuery.value = "";
    selectedApps.value = [];
    statusFilter.value = "";
  }
}
</script>

<template>
  <div class="releases-page">
    <GeneralPageHeader title="Releases">
      <template #subtitle>
        Release notes across every app. A release is created when you add a version in
        <NuxtLink to="/versions" class="subtitle-link">Versions</NuxtLink>.
      </template>
      <template #actions>
        <button
          v-if="canWriteReleases"
          type="button"
          class="btn btn-secondary"
          @click="openImportModal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Import from Notion
        </button>
        <button type="button" class="btn btn-secondary" @click="openShareModal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share public page
        </button>
      </template>
      <template #filters>
        <GeneralSplitSearch
          v-model="searchQuery"
          placeholder="Search by keyword, version"
          label="Search releases"
        >
          <template #prefix>
            <GeneralMultiSelectDropdown
              v-model="selectedApps"
              :options="appFilterOptions"
              all-label="All Apps"
              noun="apps"
              search-placeholder="Filter app name..."
              aria-label="Filter by app"
            />
          </template>
        </GeneralSplitSearch>
        <GeneralSearchableDropdown
          v-model="statusFilter"
          class="releases-filter"
          :options="statusFilterOptions"
          placeholder="All Status"
          search-placeholder="Filter status..."
        />
      </template>
    </GeneralPageHeader>

    <main class="release-timeline" aria-live="polite">
      <GeneralSkeletonReleaseTimeline v-if="isLoading" />

      <article
        v-for="r in filteredReleases"
        v-else
        :key="r.id"
        class="release-entry"
        :data-app="r.appName"
        :data-version="r.version"
      >
        <div class="release-rail">
          <time class="release-rail__date" :datetime="r.releaseDate || r.createdAt || undefined">
            {{ formatTimelineDate(r.releaseDate || r.createdAt) }}
          </time>
          <span class="release-rail__label">{{ r.published ? "Released" : r.releaseDate ? "Release date" : "Created" }}</span>
        </div>

        <div class="release-main">
          <div class="release-head__row">
            <h2 class="release-title">
              <NuxtLink :to="previewLink(r)" class="release-title__link">
                {{ formatReleaseHeading(r.appName, r.version, r.heroTitle) }}
              </NuxtLink>
            </h2>
            <div class="release-badges">
              <span class="pill" :class="publishPillClass(r.published)">
                {{ publishLabel(r.published) }}
              </span>
              <span class="pill pill-muted">{{ typeLabel(r.type) }}</span>
            </div>
          </div>
          <div class="release-chips">
            <span v-if="r.version" class="meta-chip">Version {{ formatDisplayVersion(r.version) }}</span>
            <span class="meta-chip">Product {{ r.appName }}</span>
            <span v-if="r.createdBy" class="meta-chip">Author : {{ r.createdBy }}</span>
          </div>
          <p class="release-preview">{{ getCollapsedPreview(r) }}</p>
        </div>
      </article>

      <div v-if="filteredReleases.length === 0 && !isLoading" class="empty-state">
        <p>No releases found</p>
        <span class="empty-hint">Try a different search, app or status filter</span>
      </div>
    </main>

    <div
      class="share-modal"
      :class="{ open: showShareModal }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shareTitle"
      tabindex="-1"
      @click.self="closeShareModal"
    >
      <div class="share-drawer">
        <div class="share-header">
          <h3 id="shareTitle">Share public link</h3>
          <button type="button" class="btn btn-ghost share-close" aria-label="Close" @click="closeShareModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="share-body">
          <div class="share-field">
            <label for="shareApp">Scope</label>
            <GeneralSearchableDropdown
              id="shareApp"
              v-model="shareApp"
              :options="shareAppOptions"
              placeholder="All apps"
              search-placeholder="Search apps..."
            />
          </div>

          <div class="share-field">
            <div class="share-toggle-row" @click="shareEmbed = !shareEmbed">
              <div class="share-toggle-info">
                <span class="share-toggle-label">Embed mode</span>
                <span class="share-toggle-desc">Hides the header and footer for use in an iframe</span>
              </div>
              <button
                type="button"
                class="share-toggle"
                :class="{ on: shareEmbed }"
                role="switch"
                :aria-checked="shareEmbed"
                @click.stop="shareEmbed = !shareEmbed"
              >
                <span class="share-toggle-thumb" />
              </button>
            </div>
          </div>

          <div class="share-preview">
            <label>URL preview</label>
            <code class="share-url">{{ shareUrl }}</code>
          </div>
        </div>
        <div class="share-footer">
          <button type="button" class="btn btn-secondary" @click="closeShareModal">Cancel</button>
          <button type="button" class="btn btn-primary" @click="copyShareUrl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy link
          </button>
        </div>
      </div>
    </div>

    <ReleasesNotionImportDialog
      :open="showImportModal"
      :apps="apps"
      @close="closeImportModal"
      @imported="onReleaseImported"
    />

    <ReleasesPreviewDrawer
      v-if="previewId"
      :release="previewRelease"
      :edit-link="previewRelease ? editReleaseLink(previewRelease) : null"
      :edit-label="previewRelease ? editReleaseLabel(previewRelease) : undefined"
      @close="closePreview"
    />
  </div>
</template>

<style scoped>
.releases-page {
  /* inherits global tokens */
}

.subtitle-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.release-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.release-entry {
  position: relative;
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 24px;
  padding: 24px 16px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s ease;
}

.release-entry:hover,
.release-entry:focus-within {
  background: var(--accent-soft);
}

.release-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 3px;
}

.release-rail__date {
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  line-height: 1.4;
}

.release-rail__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.release-main {
  min-width: 0;
}

.release-head__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.release-title {
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

/* Stretched link: the whole row opens the preview drawer */
.release-title__link {
  color: var(--fg);
  text-decoration: none;
}

.release-title__link::after {
  content: "";
  position: absolute;
  inset: 0;
}

.release-title__link:focus-visible {
  outline: none;
}

.release-entry:has(.release-title__link:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.release-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.release-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}

.release-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.releases-filter :deep(.dropdown-trigger) {
  min-height: 39px;
  min-width: 158px;
  font-weight: 500;
  border-color: var(--control-border);
}

.releases-filter :deep(.dropdown-trigger:hover) {
  border-color: var(--fg);
}
.pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.pill-blue {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
}

.pill-green {
  background: color-mix(in oklch, var(--success) 12%, transparent);
  color: var(--success-text);
}

.pill-amber {
  background: color-mix(in oklch, var(--warning) 12%, transparent);
  color: var(--warning-text);
}

.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

.empty-state {
  padding: 64px 24px;
  text-align: center;
}

.empty-state p {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 500;
  color: var(--fg);
}

.empty-hint {
  font-size: 13px;
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
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
  text-decoration: none;
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

/* Share modal */
.share-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-modal.open {
  opacity: 1;
  pointer-events: auto;
}

.share-drawer {
  width: 480px;
  max-width: 90vw;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  transform: scale(0.98);
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-modal.open .share-drawer {
  transform: scale(1);
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.share-header h3 {
  font-size: 16px;
  margin: 0;
  font-weight: 600;
}

.share-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius);
}

.share-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.share-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  margin-bottom: 6px;
}

.share-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  cursor: pointer;
}

.share-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.share-toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
}

.share-toggle-desc {
  font-size: 12px;
  color: var(--muted);
}

.share-toggle {
  position: relative;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--border);
  border: none;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-toggle.on {
  background: var(--accent);
}

.share-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 1px 3px color-mix(in oklch, var(--fg) 15%, transparent);
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-toggle.on .share-toggle-thumb {
  transform: translateX(16px);
}

.share-preview label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  margin-bottom: 6px;
}

.share-url {
  display: block;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
  line-height: 1.5;
}

.share-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .release-entry {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 20px 0;
  }

  .release-rail {
    flex-direction: row;
    align-items: baseline;
    gap: 10px;
  }

  .release-title {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .share-modal,
  .share-drawer,
  .btn,
  .release-title a {
    transition: none !important;
  }
}
</style>
