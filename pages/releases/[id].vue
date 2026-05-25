<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { ReleaseItem, ReleaseFeature, ReleaseMedia, ReleaseCategories } from "~/types";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const route = useRoute();
const router = useRouter();

const { release, isLoading, isUpdating, isDeleting, fetchRelease, updateRelease, deleteRelease } = useReleases();

const releaseId = computed(() => route.params.id as string);

// Fetch all published releases for prev/next navigation
const allReleases = ref<ReleaseItem[]>([]);
const isFetchingList = ref(false);

onMounted(async () => {
  if (releaseId.value) {
    await fetchRelease(releaseId.value);
    isFetchingList.value = true;
    try {
      const data = await $fetch<{ data: ReleaseItem[] }>("/api/releases", {
        query: { limit: "100" },
      });
      allReleases.value = data.data;
    } catch (e) {
      console.error("Failed to fetch releases list", e);
    } finally {
      isFetchingList.value = false;
    }
  }
});

watch(release, (r) => {
  if (r?.appName) {
    $page.setTitle(`${r.appName} ${r.version}`);
  }
  playingMedia.value = {};
  videoEls.value = {};
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════
const categoryConfig: Record<string, { label: string; pillClass: string }> = {
  fixed: { label: "Fixed", pillClass: "pill-blue" },
  added: { label: "Added", pillClass: "pill-green" },
  changed: { label: "Changed", pillClass: "pill-amber" },
  deprecated: { label: "Deprecated", pillClass: "pill-purple" },
  security: { label: "Security", pillClass: "pill-red" },
};

function countCategories(categories: ReleaseCategories | null) {
  return {
    fixed: categories?.fixed || [],
    added: categories?.added || [],
    changed: categories?.changed || [],
    deprecated: categories?.deprecated || [],
    security: categories?.security || [],
  };
}

// ═══════════════════════════════════════════════════════════════
// Sticky nav items
// ═══════════════════════════════════════════════════════════════
const navItems = computed(() => {
  const items: { id: string; label: string }[] = [];
  if (release.value?.features) {
    release.value.features.forEach((f: ReleaseFeature) => {
      items.push({ id: f.id, label: f.heading });
    });
  }
  const cats = countCategories(release.value?.categories || null);
  for (const [key, list] of Object.entries(cats)) {
    if (list.length > 0 && categoryConfig[key]) {
      items.push({ id: key, label: categoryConfig[key].label });
    }
  }
  return items;
});

// ═══════════════════════════════════════════════════════════════
// Prev / Next
// ═══════════════════════════════════════════════════════════════
const adjacent = computed(() => {
  const sorted = [...allReleases.value].sort((a, b) => {
    const da = new Date(b.releaseDate || b.createdAt || 0).getTime();
    const db = new Date(a.releaseDate || a.createdAt || 0).getTime();
    return da - db;
  });
  const idx = sorted.findIndex((r) => r.id === releaseId.value);
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
});

// ═══════════════════════════════════════════════════════════════
// Scroll spy
// ═══════════════════════════════════════════════════════════════
const activeNavIndex = ref(0);
const scrollSpyCleanup = ref<(() => void) | null>(null);

watch(navItems, async () => {
  await nextTick();
  setupScrollSpy();
});

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setupScrollSpy() {
  if (scrollSpyCleanup.value) {
    scrollSpyCleanup.value();
    scrollSpyCleanup.value = null;
  }

  const navLinks = document.querySelectorAll(".release-nav-list a");
  if (navLinks.length === 0) return;

  const sections = Array.from(navLinks)
    .map((a) => {
      const href = a.getAttribute("href");
      return href ? document.querySelector(href) : null;
    })
    .filter(Boolean) as HTMLElement[];

  function onScroll() {
    const scrollPos = window.scrollY + 140;
    let activeIndex = 0;
    sections.forEach((sec, i) => {
      if (sec && sec.offsetTop <= scrollPos) {
        activeIndex = i;
      }
    });
    activeNavIndex.value = activeIndex;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  scrollSpyCleanup.value = () => {
    window.removeEventListener("scroll", onScroll);
  };
}

onBeforeUnmount(() => {
  if (scrollSpyCleanup.value) {
    scrollSpyCleanup.value();
  }
});

// ═══════════════════════════════════════════════════════════════
// Media helpers
// ═══════════════════════════════════════════════════════════════
const playingMedia = ref<Record<string, boolean>>({});
const videoEls = ref<Record<string, any>>({});

function mediaKey(featureId: string, idx: number) {
  return `${featureId}-${idx}`;
}

function toggleVideo(key: string) {
  const el = videoEls.value[key];
  if (!el) return;
  if (el.paused) {
    el.play();
    playingMedia.value[key] = true;
  } else {
    el.pause();
    playingMedia.value[key] = false;
  }
}

function isMediaPlaceholder(m: ReleaseMedia) {
  return !m.src;
}

// ═══════════════════════════════════════════════════════════════
// Edit modal
// ═══════════════════════════════════════════════════════════════
const showEditModal = ref(false);
const editError = ref("");
const editForm = reactive({
  heroTitle: "",
  summary: "",
  published: false,
  featuresJson: "",
  categoriesJson: "",
});

function openEditModal() {
  if (!release.value) return;
  editForm.heroTitle = release.value.heroTitle || "";
  editForm.summary = release.value.summary || "";
  editForm.published = release.value.published;
  editForm.featuresJson = release.value.features ? JSON.stringify(release.value.features, null, 2) : "[]";
  editForm.categoriesJson = release.value.categories ? JSON.stringify(release.value.categories, null, 2) : "{}";
  editError.value = "";
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editError.value = "";
}

async function submitEdit() {
  if (!release.value) return;
  editError.value = "";

  let features: ReleaseFeature[] | undefined = undefined;
  let categories: ReleaseCategories | undefined = undefined;

  try {
    features = editForm.featuresJson.trim() ? JSON.parse(editForm.featuresJson) : undefined;
    categories = editForm.categoriesJson.trim() ? JSON.parse(editForm.categoriesJson) : undefined;
  } catch (e) {
    editError.value = "Invalid JSON in features or categories. Please check syntax.";
    return;
  }

  await updateRelease(release.value.id, {
    heroTitle: editForm.heroTitle,
    summary: editForm.summary,
    published: editForm.published,
    features,
    categories,
  });
  closeEditModal();
}

// ═══════════════════════════════════════════════════════════════
// Delete modal
// ═══════════════════════════════════════════════════════════════
const showDeleteModal = ref(false);
const isDeletingLocal = ref(false);

function confirmDelete() {
  showDeleteModal.value = true;
}

async function doDelete() {
  if (!release.value) return;
  isDeletingLocal.value = true;
  try {
    await deleteRelease(release.value.id);
    showDeleteModal.value = false;
    router.push("/releases");
  } finally {
    isDeletingLocal.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    showDeleteModal.value = false;
    showEditModal.value = false;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="release-detail-page">
    <!-- Loading -->
    <div v-if="isLoading" class="empty-state">
      <p>Loading release…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="!release" class="empty-state">
      <p>Release not found</p>
      <span class="meta-label">The release you're looking for doesn't exist or hasn't been published.</span>
      <br><br>
      <NuxtLink to="/releases" class="btn btn-primary">View all releases</NuxtLink>
    </div>

    <!-- Content -->
    <div v-else class="release-content">
      <!-- Local topbar -->
      <header class="topbar">
        <div class="flex-gap-md">
          <h1>Release Notes</h1>
          <span class="pill pill-accent">{{ release.appName }} {{ release.version }}</span>
        </div>
        <div class="flex-gap-sm">
          <NuxtLink to="/releases" class="btn btn-ghost btn-sm">All releases</NuxtLink>
          <NuxtLink :to="`/changelogs?app=${release.appId}`" class="btn btn-secondary btn-sm">Edit changelog</NuxtLink>
          <button type="button" class="btn btn-secondary btn-sm" @click="openEditModal">Edit release</button>
          <button type="button" class="btn btn-danger btn-sm" @click="confirmDelete">Delete</button>
        </div>
      </header>

      <!-- Article layout -->
      <div class="article-layout">
        <article class="article-wrap">
          <!-- Hero -->
          <header class="release-hero">
            <div class="release-hero-date">{{ formatDate(release.releaseDate) }}</div>
            <h1 class="release-hero-title">{{ release.heroTitle || `${release.appName} ${release.version}` }}</h1>
            <div class="release-hero-meta">
              <span class="release-hero-app">{{ release.appName }}</span>
              <span class="pill pill-accent">{{ release.version }}</span>
              <NuxtLink :to="`/versions?app=${release.appId}`" class="text-muted-sm" style="text-decoration:underline;text-underline-offset:2px;">
                View version timeline
              </NuxtLink>
            </div>
          </header>

          <!-- Summary -->
          <div v-if="release.summary" class="release-summary-block">
            <p>{{ release.summary }}</p>
          </div>

          <!-- Features -->
          <section
            v-for="feature in release.features || []"
            :key="feature.id"
            :id="feature.id"
            class="feature-section"
          >
            <h2 class="feature-heading">{{ feature.heading }}</h2>
            <p class="feature-desc">{{ feature.description }}</p>

            <!-- Media -->
            <div
              v-if="feature.media && feature.media.length > 0"
              class="media-grid"
              :class="feature.media.length === 2 ? 'media-grid-2' : feature.media.length >= 3 ? 'media-grid-3' : ''"
            >
              <div
                v-for="(m, idx) in feature.media"
                :key="idx"
                class="media-container"
                :class="{ 'video-wrapper': m.type === 'video' && m.src, playing: playingMedia[mediaKey(feature.id, idx)] }"
                @click="m.type === 'video' && m.src ? toggleVideo(mediaKey(feature.id, idx)) : undefined"
              >
                <!-- Video placeholder -->
                <template v-if="m.type === 'video' && isMediaPlaceholder(m)">
                  <div class="media-placeholder-inner">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right:12px;opacity:.5;">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {{ m.alt || "Video" }}
                  </div>
                  <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                </template>

                <!-- Video player -->
                <template v-else-if="m.type === 'video' && m.src">
                  <video
                    :ref="(el) => { const k = mediaKey(feature.id, idx); if (el) videoEls.value[k] = el as HTMLVideoElement; else delete videoEls.value[k]; }"
                    :src="m.src"
                    preload="metadata"
                    playsinline
                    muted
                    loop
                    @click.stop
                  />
                  <div class="video-overlay">
                    <div class="play-btn">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                  <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                </template>

                <!-- Image placeholder -->
                <template v-else-if="m.type === 'image' && isMediaPlaceholder(m)">
                  <div class="media-placeholder-inner">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right:12px;opacity:.5;">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    {{ m.alt || "Image" }}
                  </div>
                  <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                </template>

                <!-- Image -->
                <template v-else>
                  <img :src="m.src" :alt="m.alt || ''" loading="lazy" />
                  <div v-if="m.alt" class="media-caption">{{ m.alt }}</div>
                </template>
              </div>
            </div>
          </section>

          <!-- Categories -->
          <template v-if="release.categories">
            <section
              v-for="[key, items] in Object.entries(countCategories(release.categories)).filter(([, v]) => v.length > 0)"
              :key="key"
              :id="key"
              class="changes-section"
            >
              <h3 class="changes-heading">
                <span class="pill" :class="categoryConfig[key]?.pillClass || 'pill-muted'">
                  {{ categoryConfig[key]?.label || key }}
                </span>
              </h3>
              <ul class="changes-list">
                <li v-for="(item, idx) in items" :key="idx" v-html="item" />
              </ul>
            </section>
          </template>

          <!-- Prev / Next -->
          <nav class="release-footer-nav" aria-label="Release navigation">
            <NuxtLink v-if="adjacent.prev" :to="`/releases/${adjacent.prev.id}`" class="prev">
              <span class="label">Previous</span>
              <span class="version">{{ adjacent.prev.appName }} {{ adjacent.prev.version }}</span>
              <span class="date">{{ formatDate(adjacent.prev.releaseDate) }}</span>
            </NuxtLink>
            <div v-else />
            <NuxtLink v-if="adjacent.next" :to="`/releases/${adjacent.next.id}`" class="next">
              <span class="label">Next</span>
              <span class="version">{{ adjacent.next.appName }} {{ adjacent.next.version }}</span>
              <span class="date">{{ formatDate(adjacent.next.releaseDate) }}</span>
            </NuxtLink>
            <div v-else />
          </nav>
        </article>

        <!-- Sticky nav -->
        <nav v-if="navItems.length > 0" class="release-nav" aria-label="On this page">
          <div class="release-nav-title">On this page</div>
          <ul class="release-nav-list">
            <li v-for="(item, idx) in navItems" :key="item.id">
              <a :href="`#${item.id}`" :class="{ active: activeNavIndex === idx }" @click.prevent="scrollToSection(item.id)">
                {{ item.label }}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal-overlay" :class="{ open: showEditModal }" @click.self="closeEditModal">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>Edit Release</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeEditModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="editError" class="error-banner">{{ editError }}</div>
          <div class="form-group">
            <label>Hero Title</label>
            <input v-model="editForm.heroTitle" type="text" placeholder="e.g. Request tracing and deep health checks" />
          </div>
          <div class="form-group">
            <label>Summary</label>
            <textarea v-model="editForm.summary" rows="3" placeholder="Short summary of this release…" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="flex-gap-sm" style="cursor:pointer;">
                <input v-model="editForm.published" type="checkbox" />
                Published
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Features JSON</label>
            <textarea v-model="editForm.featuresJson" rows="6" placeholder="[{ &quot;id&quot;: &quot;...&quot;, &quot;heading&quot;: &quot;...&quot;, &quot;description&quot;: &quot;...&quot;, &quot;media&quot;: [...] }]" />
            <span class="help-text">Array of feature objects. Use JSON syntax.</span>
          </div>
          <div class="form-group">
            <label>Categories JSON</label>
            <textarea v-model="editForm.categoriesJson" rows="4" placeholder="{ &quot;added&quot;: [...], &quot;fixed&quot;: [...], ... }" />
            <span class="help-text">Object with keys: added, fixed, changed, deprecated, security.</span>
          </div>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="closeEditModal">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="isUpdating" @click="submitEdit">
            <span v-if="isUpdating">Saving…</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: showDeleteModal }" @click.self="showDeleteModal = false">
      <div class="modal-panel" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Delete Release</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="showDeleteModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to delete the release for <strong>{{ release?.appName }} {{ release?.version }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Cancel</button>
          <button type="button" class="btn btn-danger" :disabled="isDeletingLocal || isDeleting" @click="doDelete">
            <span v-if="isDeletingLocal || isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══ Page layout ══════════════════════════════════════════════ */
.release-detail-page {
  width: 100%;
}

/* ═══ Topbar ═══════════════════════════════════════════════════ */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}

.flex-gap-sm {
  display: flex;
  gap: 8px;
  align-items: center;
}
.flex-gap-md {
  display: flex;
  gap: 16px;
  align-items: center;
}

.text-muted-sm {
  color: var(--muted);
  font-size: 13px;
}

.meta-label {
  font-size: 12px;
  color: var(--muted);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* ═══ Buttons ══════════════════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
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
.btn-sm {
  padding: 4px 12px;
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

/* ═══ Pills ════════════════════════════════════════════════════ */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
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
  background: color-mix(in oklch, oklch(70% 0.14 85) 12%, transparent);
  color: oklch(55% 0.12 85);
}
.pill-red {
  background: color-mix(in oklch, oklch(60% 0.18 25) 12%, transparent);
  color: oklch(55% 0.14 25);
}
.pill-purple {
  background: color-mix(in oklch, oklch(60% 0.16 300) 12%, transparent);
  color: oklch(55% 0.14 300);
}
.pill-accent {
  background: var(--accent-soft);
  color: var(--accent);
}
.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

/* ═══ Article layout ═════════════════════════════════════════ */
.article-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
}

.article-wrap {
  width: 100%;
  max-width: 720px;
}

/* Hero */
.release-hero {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.release-hero-date {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
}
.release-hero-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin-bottom: 16px;
  color: var(--fg);
}
.release-hero-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.release-hero-app {
  font-size: 14px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.release-hero-app::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

/* Summary */
.release-summary-block {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  margin-bottom: 32px;
  max-width: 65ch;
}
.release-summary-block p {
  margin: 0;
}

/* ═══ Feature sections ═══════════════════════════════════════ */
.feature-section {
  margin: 48px 0;
  padding: 24px 0;
  border-top: 1px solid var(--border);
}
.feature-section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}
.feature-heading {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 16px;
  color: var(--fg);
}
.feature-desc {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  margin-bottom: 24px;
  max-width: 65ch;
}

/* ═══ Media system ═════════════════════════════════════════════ */
.media-container {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.media-container img,
.media-container video {
  width: 100%;
  display: block;
  aspect-ratio: 16/9;
  object-fit: cover;
}
.media-caption {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.media-placeholder-inner {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 14px;
  background: var(--bg);
}

/* Media grid */
.media-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}
.media-grid-2 {
  grid-template-columns: repeat(2, 1fr);
}
.media-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 640px) {
  .media-grid-2,
  .media-grid-3 {
    grid-template-columns: 1fr;
  }
}
.media-grid .media-container {
  margin-bottom: 0;
}
.media-grid .media-container img,
.media-grid .media-container video,
.media-grid .media-placeholder-inner {
  aspect-ratio: 4/3;
}

/* Video play overlay */
.video-wrapper {
  position: relative;
  cursor: pointer;
}
.video-wrapper video {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
}
.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--fg) 20%, transparent);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.video-wrapper.playing .video-overlay,
.video-wrapper:hover .video-overlay {
  opacity: 0;
}
.play-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 15%, transparent);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.play-btn:hover {
  transform: scale(1.05);
}
.play-btn svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
  margin-left: 4px;
}

/* ═══ Change categories ═══════════════════════════════════════ */
.changes-section {
  margin: 48px 0;
}
.changes-section:first-of-type {
  margin-top: 0;
}
.changes-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
}
.changes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.changes-list li {
  padding: 10px 0;
  font-size: 15px;
  line-height: 1.6;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
  color: var(--fg);
}
.changes-list li:last-child {
  border-bottom: none;
}
.changes-list :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

/* ═══ Sticky nav ═══════════════════════════════════════════════ */
.release-nav {
  position: sticky;
  top: 24px;
  width: 200px;
  flex-shrink: 0;
  margin-left: 48px;
}
.release-nav-title {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
  margin-bottom: 12px;
}
.release-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.release-nav-list a {
  display: block;
  padding: 6px 0;
  font-size: 13px;
  color: var(--muted);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: 2px solid transparent;
  padding-left: 12px;
  margin-left: -12px;
  text-decoration: none;
}
.release-nav-list a:hover {
  color: var(--fg);
}
.release-nav-list a.active {
  color: var(--accent);
  font-weight: 500;
  border-left-color: var(--accent);
}

/* ═══ Prev / Next ══════════════════════════════════════════════ */
.release-footer-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.release-footer-nav a {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
}
.release-footer-nav a:hover {
  border-color: var(--fg);
  background: var(--surface);
}
.release-footer-nav a.next {
  text-align: right;
  align-items: flex-end;
}
.release-footer-nav .label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.release-footer-nav .version {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}
.release-footer-nav .date {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

/* ═══ Empty state ══════════════════════════════════════════════ */
.empty-state {
  padding: 64px 24px;
  text-align: center;
  color: var(--muted);
}
.empty-state p {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

/* ═══ Modal ══════════════════════════════════════════════════ */
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
  font-weight: 600;
  color: var(--fg);
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
.modal-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.modal-body {
  padding: 20px 24px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

/* Form elements */
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
.form-group input[type="text"],
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
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.form-group textarea {
  min-height: 80px;
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
.help-text {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
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

/* ═══ Responsive ═══════════════════════════════════════════════ */
@media (max-width: 1024px) {
  .release-nav {
    display: none;
  }
}
@media (max-width: 768px) {
  .release-hero-title {
    font-size: 28px;
  }
  .release-footer-nav {
    grid-template-columns: 1fr;
  }
  .release-footer-nav a.next {
    text-align: left;
    align-items: flex-start;
  }
  .topbar {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .media-container,
  .video-overlay,
  .play-btn,
  .release-footer-nav a,
  .release-nav-list a,
  .modal-overlay,
  .modal-panel {
    transition: none !important;
  }
}
</style>
