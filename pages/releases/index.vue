<script setup lang="ts">
import { usePageStore } from "~/store/page";
import { extractHeadings, renderMarkdown } from "~/composables/useMarkdown";
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
const { apps, fetchApps } = useApps();
const { releases, isLoading, fetchReleases } = useReleases();

const searchQuery = ref("");
const appFilter = ref((route.query.app as string) || "");
const expandedReleaseId = ref<string | null>(null);

watch(
  () => route.query.app,
  (app) => {
    appFilter.value = (app as string) || "";
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

const filteredReleases = computed(() =>
  [...releases.value].sort((a, b) => {
    const dA = new Date(a.releaseDate || a.createdAt || 0).getTime();
    const dB = new Date(b.releaseDate || b.createdAt || 0).getTime();
    return dB - dA;
  }),
);

watch(filteredReleases, (list) => {
  if (
    expandedReleaseId.value
    && !list.some((r) => r.id === expandedReleaseId.value)
  ) {
    expandedReleaseId.value = null;
  }
});

const appFilterOptions = computed(() => [
  { id: "", label: "Semua apps" },
  ...apps.value.map((a) => ({ id: a.name, label: a.name })),
]);

function formatTimelineDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
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

const categoryConfig: Record<string, { label: string; tagClass: string }> = {
  fixed: { label: "Fixed", tagClass: "rl-tag-fixed" },
  added: { label: "Added", tagClass: "rl-tag-added" },
  changed: { label: "Changed", tagClass: "rl-tag-changed" },
  deprecated: { label: "Deprecated", tagClass: "rl-tag-deprecated" },
  security: { label: "Security", tagClass: "rl-tag-security" },
};

function getSummaryBlurb(summary: string | null): string {
  if (!summary?.trim()) return "";
  const body = summary.replace(/^---[\s\S]*?---\n?/, "").trim();
  const intro = body.split(/^#{1,3}\s/m)[0].trim();
  const text = intro.replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
  if (!text) return "";
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

function getOutlineItems(summary: string | null) {
  return extractHeadings(summary || "").filter((h) => h.level <= 3);
}

function getCollapsedPreview(r: ReleaseItem): string {
  const blurb = getSummaryBlurb(r.summary);
  if (blurb) return blurb;
  if (r.type === "normal" && r.categories) {
    const cats = countCategories(r.categories);
    const total = Object.values(cats).reduce((sum, items) => sum + items.length, 0);
    if (total > 0) {
      return `${total} perubahan pada rilis ${formatDisplayVersion(r.version)}.`;
    }
  }
  return `Rilis ${formatDisplayVersion(r.version)} untuk ${r.appName}.`;
}

function isExpanded(id: string) {
  return expandedReleaseId.value === id;
}

function expandRelease(id: string) {
  expandedReleaseId.value = id;
}

function collapseRelease(id: string) {
  if (expandedReleaseId.value === id) expandedReleaseId.value = null;
}

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
  { id: "", label: "Semua apps" },
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
    alert("Tautan publik disalin");
    closeShareModal();
  } catch {
    const input = document.createElement("input");
    input.value = shareUrl.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    alert("Tautan publik disalin");
    closeShareModal();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (showShareModal.value) {
      closeShareModal();
      return;
    }
    searchQuery.value = "";
    appFilter.value = "";
  }
}
</script>

<template>
  <div class="releases-page">
    <header class="page-masthead">
      <div class="page-masthead__copy">
        <h1>Releases</h1>
        <p class="page-subtitle">
          Catatan rilis, pembaruan, dan draft lintas aplikasi.
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="openShareModal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Bagikan
      </button>
    </header>

    <div class="filter-strip">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Cari rilis..."
          aria-label="Cari rilis"
        />
      </div>
      <GeneralSearchableDropdown
        v-model="appFilter"
        :options="appFilterOptions"
        placeholder="Semua apps"
        search-placeholder="Cari app..."
      />
    </div>

    <main class="release-timeline" aria-live="polite">
      <GeneralSkeletonReleaseTimeline v-if="isLoading" />

      <article
        v-for="r in filteredReleases"
        v-else
        :key="r.id"
        class="release-entry"
        :class="{ 'is-expanded': isExpanded(r.id) }"
        :data-app="r.appName"
        :data-version="r.version"
      >
        <div class="release-rail">
          <time class="release-rail__date" :datetime="r.releaseDate || r.createdAt || undefined">
            {{ formatTimelineDate(r.releaseDate || r.createdAt) }}
          </time>
          <span class="release-rail__label">Rilis</span>
        </div>

        <div class="release-main">
          <header class="release-head">
            <div class="release-head__row">
              <h2 class="release-title">
                <NuxtLink :to="`/releases/${r.id}`">
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
              <span v-if="r.version" class="meta-chip">Versi {{ formatDisplayVersion(r.version) }}</span>
              <span class="meta-chip">Produk {{ r.appName }}</span>
            </div>
          </header>

          <template v-if="isExpanded(r.id)">
            <section
              v-if="getSummaryBlurb(r.summary)"
              class="release-panel release-panel--summary"
              aria-label="Ringkasan rilis"
            >
              <div class="release-panel__head">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
                </svg>
                <span>Ringkasan rilis</span>
              </div>
              <p class="release-panel__text">{{ getSummaryBlurb(r.summary) }}</p>
            </section>

            <section
              v-if="r.type === 'article' && getOutlineItems(r.summary).length"
              class="release-panel release-panel--outline"
              aria-label="Daftar isi"
            >
              <div class="release-panel__head">
                <span class="release-panel__eyebrow">Daftar isi</span>
              </div>
              <ul class="release-outline" role="list">
                <li
                  v-for="(heading, idx) in getOutlineItems(r.summary)"
                  :key="`${r.id}-h-${idx}`"
                  :class="`release-outline__item level-${heading.level}`"
                >
                  {{ heading.text }}
                </li>
              </ul>
            </section>

            <div class="release-content">
              <template v-if="r.type === 'normal' && r.categories">
                <div
                  v-for="[key, items] in Object.entries(countCategories(r.categories)).filter(([, v]) => v.length > 0)"
                  :key="key"
                  class="rl-cat-group"
                >
                  <h3 class="rl-cat-heading">
                    <span class="rl-cat-badge" :class="categoryConfig[key]?.tagClass || 'rl-tag-muted'">
                      {{ categoryConfig[key]?.label || key }}
                    </span>
                  </h3>
                  <ul class="rl-cat-list">
                    <li v-for="item in items" :key="item">{{ item }}</li>
                  </ul>
                </div>
              </template>
              <MermaidHtml
                v-else-if="r.summary"
                class="release-markdown"
                :html="renderMarkdown(r.summary)"
              />
            </div>

            <footer class="release-foot">
              <span class="release-foot__app">{{ r.appName }}</span>
              <NuxtLink
                v-if="editReleaseLink(r)"
                :to="editReleaseLink(r)!"
                class="release-foot__edit"
              >
                {{ editReleaseLabel(r) }}
              </NuxtLink>
            </footer>

            <button
              type="button"
              class="release-toggle"
              @click="collapseRelease(r.id)"
            >
              Sembunyikan konten
            </button>
          </template>

          <template v-else>
            <p class="release-preview">{{ getCollapsedPreview(r) }}</p>
            <button
              type="button"
              class="release-toggle"
              @click="expandRelease(r.id)"
            >
              Tampilkan konten
            </button>
          </template>
        </div>
      </article>

      <div v-if="filteredReleases.length === 0 && !isLoading" class="empty-state">
        <p>Tidak ada rilis ditemukan</p>
        <span class="empty-hint">Coba ubah pencarian atau filter app</span>
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
          <h3 id="shareTitle">Bagikan tautan publik</h3>
          <button type="button" class="btn btn-ghost share-close" aria-label="Tutup" @click="closeShareModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="share-body">
          <div class="share-field">
            <label for="shareApp">Cakupan</label>
            <GeneralSearchableDropdown
              id="shareApp"
              v-model="shareApp"
              :options="shareAppOptions"
              placeholder="Semua apps"
              search-placeholder="Cari app..."
            />
          </div>

          <div class="share-field">
            <div class="share-toggle-row" @click="shareEmbed = !shareEmbed">
              <div class="share-toggle-info">
                <span class="share-toggle-label">Mode embed</span>
                <span class="share-toggle-desc">Menghilangkan header dan footer untuk iframe</span>
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
            <label>Pratinjau URL</label>
            <code class="share-url">{{ shareUrl }}</code>
          </div>
        </div>
        <div class="share-footer">
          <button type="button" class="btn btn-secondary" @click="closeShareModal">Batal</button>
          <button type="button" class="btn btn-primary" @click="copyShareUrl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Salin tautan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.releases-page {
  /* inherits global tokens */
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

.filter-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
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

.release-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.release-entry {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 24px;
  padding: 28px 0;
  border-bottom: 1px solid var(--border);
}

.release-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}

.release-rail__date {
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  line-height: 1.4;
}

.release-rail__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.release-main {
  min-width: 0;
}

.release-head {
  margin-bottom: 16px;
}

.release-head__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.release-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.release-title a {
  color: var(--fg);
  text-decoration: none;
  transition: color 0.15s ease;
}

.release-title a:hover {
  color: var(--accent);
}

.release-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.release-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}

.release-panel {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--fg) 2%, var(--surface));
}

.release-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.release-panel__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.release-panel__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  max-width: 72ch;
}

.release-outline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.release-outline__item {
  font-size: 14px;
  color: var(--fg);
  line-height: 1.4;
}

.release-outline__item.level-2 {
  padding-left: 12px;
  color: var(--muted);
}

.release-outline__item.level-3 {
  padding-left: 24px;
  font-size: 13px;
  color: var(--muted);
}

.release-content {
  margin-bottom: 20px;
  max-width: 72ch;
}

.release-markdown :deep(.preview-body) {
  max-width: none;
  font-size: 14px;
  line-height: 1.65;
  color: var(--fg);
}

.release-markdown :deep(h2),
.release-markdown :deep(h3) {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-size: 15px;
  font-weight: 600;
}

.release-markdown :deep(p) {
  margin: 0 0 0.75em;
  color: var(--muted);
}

.release-markdown :deep(ul) {
  margin: 0 0 1em;
  padding-left: 1.25rem;
}

.release-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  margin-bottom: 12px;
}

.release-foot__app {
  font-size: 13px;
  color: var(--muted);
}

.release-foot__edit {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.release-foot__edit:hover {
  color: var(--accent);
}

.release-preview {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 68ch;
}

.release-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.release-toggle::before {
  content: "›";
  text-decoration: none;
  font-size: 15px;
  line-height: 1;
}

.release-toggle:hover {
  color: var(--accent);
}

.release-entry:not(.is-expanded) .release-head {
  margin-bottom: 8px;
}

.release-entry:not(.is-expanded) .release-title {
  font-size: 18px;
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
  background: color-mix(in oklch, oklch(60% 0.16 255) 12%, transparent);
  color: oklch(55% 0.14 255);
}

.pill-green {
  background: color-mix(in oklch, oklch(60% 0.18 145) 12%, transparent);
  color: oklch(50% 0.14 145);
}

.pill-amber {
  background: color-mix(in oklch, oklch(75% 0.14 85) 12%, transparent);
  color: oklch(60% 0.12 85);
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

.rl-cat-group {
  margin-bottom: 16px;
}

.rl-cat-heading {
  margin: 0 0 8px;
}

.rl-cat-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.4;
}

.rl-cat-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
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
  background: color-mix(in oklch, oklch(55% 0.2 295) 12%, transparent);
  color: oklch(50% 0.16 295);
}

.rl-tag-security {
  background: color-mix(in oklch, oklch(55% 0.18 25) 12%, transparent);
  color: oklch(50% 0.16 25);
}

.rl-tag-muted {
  background: var(--fg-soft);
  color: var(--muted);
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
  .page-masthead {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrap {
    max-width: none;
    flex-basis: auto;
  }

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
