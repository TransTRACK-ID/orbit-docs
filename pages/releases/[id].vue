<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { ReleaseItem } from "~/composables/useReleases";

definePageMeta({
  auth: { required: true },
});

const $page = usePageStore();
const route = useRoute();
const router = useRouter();

const { release, isLoading, fetchRelease, updateRelease, deleteRelease } = useReleases();

const releaseId = computed(() => route.params.id as string);

onMounted(async () => {
  if (releaseId.value) {
    await fetchRelease(releaseId.value);
    if (release.value?.appName) {
      $page.setTitle(`${release.value.appName} ${release.value.version}`);
    }
  }
});

watch(release, (r) => {
  if (r?.appName) {
    $page.setTitle(`${r.appName} ${r.version}`);
  }
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function categoryLabel(key: string) {
  const labels: Record<string, string> = {
    added: "Added",
    fixed: "Fixed",
    changed: "Changed",
    deprecated: "Deprecated",
    security: "Security",
  };
  return labels[key] || key;
}

function categoryClass(key: string) {
  const classes: Record<string, string> = {
    added: "cat-added",
    fixed: "cat-fixed",
    changed: "cat-changed",
    deprecated: "cat-deprecated",
    security: "cat-security",
  };
  return classes[key] || "";
}

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
      <NuxtLink to="/releases" class="btn btn-secondary" style="margin-top: 12px;">
        Back to releases
      </NuxtLink>
    </div>

    <!-- Release content -->
    <div v-else>
      <!-- Header -->
      <div class="detail-header">
        <div>
          <div class="flex-gap-sm" style="margin-bottom: 8px;">
            <span class="pill" :class="release.versionStatus === 'published' ? 'pill-green' : 'pill-blue'">
              {{ release.versionStatus }}
            </span>
            <span class="text-muted-sm">{{ formatDate(release.releaseDate) }}</span>
          </div>
          <h1 class="detail-title">{{ release.appName }} {{ release.version }}</h1>
          <p v-if="release.heroTitle" class="detail-hero">{{ release.heroTitle }}</p>
        </div>
        <div class="flex-gap-sm">
          <NuxtLink :to="`/versions?app=${release.appId}`" class="btn btn-secondary">
            Edit changelog
          </NuxtLink>
          <button type="button" class="btn btn-danger" @click="confirmDelete">
            Delete
          </button>
        </div>
      </div>

      <!-- Summary -->
      <div v-if="release.summary" class="card" style="margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: var(--fg);">
          {{ release.summary }}
        </p>
      </div>

      <!-- Features -->
      <div v-if="release.features && release.features.length > 0" class="features-section">
        <h2 class="section-title">Features</h2>
        <div class="features-grid">
          <div
            v-for="feature in release.features"
            :key="feature.id"
            class="card feature-card"
          >
            <h3 class="feature-heading">{{ feature.heading }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
            <div v-if="feature.media && feature.media.length > 0" class="media-grid">
              <div
                v-for="(m, idx) in feature.media"
                :key="idx"
                class="media-placeholder"
              >
                <span class="media-badge">{{ m.type }}</span>
                <span class="media-label">{{ m.alt }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories -->
      <div v-if="release.categories" class="categories-section">
        <h2 class="section-title">Changelog</h2>
        <div class="categories-grid">
          <div
            v-for="[key, items] in Object.entries(countCategories(release.categories)).filter(([, v]) => v.length > 0)"
            :key="key"
            class="card category-card"
            :class="categoryClass(key)"
          >
            <h3 class="category-title">{{ categoryLabel(key) }}</h3>
            <ul class="category-list">
              <li v-for="(item, idx) in items" :key="idx">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="card meta-card" style="margin-top: 24px;">
        <h3 class="section-title" style="margin-bottom: 12px;">Metadata</h3>
        <div class="meta-grid">
          <div>
            <span class="meta-label">App</span>
            <span class="meta-value">{{ release.appName }}</span>
          </div>
          <div>
            <span class="meta-label">Version</span>
            <span class="meta-value num">{{ release.version }}</span>
          </div>
          <div>
            <span class="meta-label">Status</span>
            <span class="meta-value">{{ release.versionStatus }}</span>
          </div>
          <div>
            <span class="meta-label">Release Date</span>
            <span class="meta-value">{{ formatDate(release.releaseDate) }}</span>
          </div>
          <div v-if="release.createdBy">
            <span class="meta-label">Author</span>
            <span class="meta-value">{{ release.createdBy }}</span>
          </div>
          <div>
            <span class="meta-label">Published</span>
            <span class="meta-value">{{ release.published ? "Yes" : "No" }}</span>
          </div>
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
          <button type="button" class="btn btn-danger" :disabled="isDeletingLocal" @click="doDelete">
            <span v-if="isDeletingLocal">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.release-detail-page {
  max-width: 960px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.detail-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: var(--fg);
}

.detail-hero {
  font-size: 16px;
  color: var(--muted);
  margin: 8px 0 0;
  line-height: 1.5;
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
  text-decoration: none;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--fg);
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
  padding: 20px;
}

.section-title {
  font-size: 14px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  margin: 0 0 16px;
}

.features-section {
  margin-bottom: 24px;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.feature-card {
  padding: 20px;
}

.feature-heading {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--fg);
}

.feature-description {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
  margin: 0 0 12px;
}

.media-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.media-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 160px;
  height: 100px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
}

.media-badge {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-weight: 500;
}

.media-label {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  line-height: 1.3;
}

.categories-section {
  margin-bottom: 24px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 768px) {
  .categories-grid {
    grid-template-columns: 1fr;
  }
}

.category-card {
  padding: 20px;
  border-left: 3px solid transparent;
}

.category-card.cat-added {
  border-left-color: oklch(50% 0.14 145);
}
.category-card.cat-fixed {
  border-left-color: oklch(55% 0.14 255);
}
.category-card.cat-changed {
  border-left-color: oklch(60% 0.12 85);
}
.category-card.cat-deprecated {
  border-left-color: oklch(55% 0.14 300);
}
.category-card.cat-security {
  border-left-color: oklch(55% 0.14 25);
}

.category-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 12px;
}

.category-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.category-list li {
  font-size: 14px;
  color: var(--fg);
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  line-height: 1.4;
}
.category-list li:last-child {
  border-bottom: none;
}

.meta-card {
  padding: 20px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 768px) {
  .meta-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
}

.meta-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 500;
  margin-bottom: 4px;
}

.meta-value {
  font-size: 14px;
  color: var(--fg);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.empty-state {
  padding: 64px 24px;
  text-align: center;
  color: var(--muted);
}
.empty-state p {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--fg);
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

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-panel,
  .btn,
  .card {
    transition: none !important;
  }
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
  }
}
</style>
