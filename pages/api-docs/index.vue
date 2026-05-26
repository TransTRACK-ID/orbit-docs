<script setup lang="ts">
import { usePageStore } from "~/store/page";

interface ApiDocCollection {
  id: string;
  name: string;
  description: string | null;
  publicSlug: string | null;
  docMode: string;
  baseUrl: string | null;
  stats: {
    totalEndpoints: number;
    methods: Record<string, number>;
  };
}

interface CollectionsResponse {
  collections: ApiDocCollection[];
}

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const router = useRouter();

const collections = ref<ApiDocCollection[]>([]);
const isLoading = ref(false);
const listError = ref("");

const searchQuery = ref("");
const slugInput = ref("");
const isNavigating = ref(false);

onBeforeMount(() => {
  $page.setTitle("API Docs");
});

/* ── Fetch collections list ────────────────────────────────── */
async function fetchCollections() {
  isLoading.value = true;
  listError.value = "";
  try {
    const result = await $fetch<CollectionsResponse>("/api/api-docs", {
      query: searchQuery.value ? { search: searchQuery.value } : undefined,
    });
    collections.value = result.collections || [];
  } catch (e: any) {
    listError.value = "Failed to load API documentation list";
    console.error("[api-docs] fetch list error:", e);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchCollections();
});

/* ── Search debounce ───────────────────────────────────────── */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchCollections();
  }, 300);
}

/* ── Navigate to collection docs ────────────────────────────── */
function viewCollection(slug: string) {
  if (!slug) return;
  isNavigating.value = true;
  router.push(`/api-docs/${slug}`);
}

function viewDocsFromInput() {
  const slug = slugInput.value.trim();
  if (!slug) return;
  isNavigating.value = true;
  router.push(`/api-docs/${slug}`);
}

function onSlugKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    viewDocsFromInput();
  }
}

const isValidSlug = computed(() => slugInput.value.trim().length > 0);

/* ── Helpers ───────────────────────────────────────────────── */
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: "oklch(55% 0.16 255)",
    POST: "oklch(55% 0.16 145)",
    PUT: "oklch(60% 0.16 85)",
    PATCH: "oklch(55% 0.16 300)",
    DELETE: "oklch(55% 0.16 25)",
    HEAD: "oklch(55% 0.02 250)",
    OPTIONS: "oklch(55% 0.1 190)",
  };
  return colors[method] || "oklch(55% 0.02 250)";
}

function getMethodBg(method: string): string {
  const color = getMethodColor(method);
  return `color-mix(in oklch, ${color} 12%, transparent)`;
}
</script>

<template>
  <div class="api-docs-landing">
    <div class="landing-content">
      <!-- Header -->
      <div class="landing-header">
        <div class="landing-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h1 class="landing-title">API Documentation</h1>
        <p class="landing-desc">
          Browse published API documentation collections from Postrack.
        </p>
      </div>

      <!-- Search -->
      <div class="search-box">
        <div class="input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search collections..."
            class="search-input"
            @input="onSearchInput"
          />
        </div>
      </div>

      <!-- Collections Grid -->
      <div v-if="isLoading" class="collections-grid">
        <div v-for="n in 6" :key="n" class="collection-card skeleton">
          <div class="sk-title" />
          <div class="sk-desc" />
          <div class="sk-stats" />
        </div>
      </div>

      <div v-else-if="listError" class="list-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ listError }}</span>
      </div>

      <div v-else-if="collections.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p class="empty-title">No collections found</p>
        <p class="empty-desc">
          {{ searchQuery ? 'No collections match your search.' : 'No public API documentation collections are available yet.' }}
        </p>
      </div>

      <div v-else class="collections-grid">
        <div
          v-for="collection in collections"
          :key="collection.id"
          class="collection-card"
          @click="viewCollection(collection.publicSlug || '')"
        >
          <div class="card-header">
            <h3 class="card-title">{{ collection.name }}</h3>
            <span v-if="collection.publicSlug" class="slug-badge">{{ collection.publicSlug }}</span>
          </div>
          <p v-if="collection.description" class="card-desc">
            {{ collection.description }}
          </p>
          <div class="card-footer">
            <div class="stats">
              <span class="endpoint-count">
                {{ collection.stats.totalEndpoints }} endpoint{{ collection.stats.totalEndpoints !== 1 ? 's' : '' }}
              </span>
              <div v-if="Object.keys(collection.stats.methods).length > 0" class="method-badges">
                <span
                  v-for="(count, method) in collection.stats.methods"
                  :key="method"
                  class="method-badge"
                  :style="{
                    backgroundColor: getMethodBg(method),
                    color: getMethodColor(method),
                  }"
                >
                  {{ method }} {{ count }}
                </span>
              </div>
            </div>
            <span class="doc-mode">{{ collection.docMode }}</span>
          </div>
        </div>
      </div>

      <!-- Direct Slug Entry -->
      <div class="direct-entry">
        <div class="divider">
          <span>or enter slug directly</span>
        </div>
        <div class="slug-box">
          <div class="input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="slugInput"
              type="text"
              placeholder="Enter collection slug (e.g. my-api-docs)"
              class="slug-input"
              @keydown="onSlugKeydown"
            />
          </div>
          <button
            class="view-btn"
            :disabled="!isValidSlug || isNavigating"
            @click="viewDocsFromInput"
          >
            <span v-if="isNavigating">Loading...</span>
            <span v-else>View Docs</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-docs-landing {
  padding: 32px;
  max-width: 960px;
  margin: 0 auto;
}

.landing-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.landing-header {
  text-align: center;
}

.landing-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg, 12px);
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
  margin-bottom: 16px;
}

.landing-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--fg, oklch(20% 0.02 250));
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.landing-desc {
  font-size: 14px;
  color: var(--muted, oklch(55% 0.015 250));
  margin: 0;
  line-height: 1.6;
}

/* Search */
.search-box {
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface, oklch(100% 0 0));
  border: 1px solid var(--border, oklch(90% 0.006 250));
  border-radius: var(--radius, 8px);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-wrap:focus-within {
  border-color: var(--accent, oklch(55% 0.16 25));
  box-shadow: 0 0 0 3px var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
}

.search-icon {
  color: var(--muted, oklch(55% 0.015 250));
  flex-shrink: 0;
}

.search-input,
.slug-input {
  flex: 1;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg, oklch(20% 0.02 250));
  outline: none;
  min-width: 0;
}

.search-input::placeholder,
.slug-input::placeholder {
  color: var(--muted, oklch(55% 0.015 250));
}

/* Collections Grid */
.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.collection-card {
  background: var(--surface, oklch(100% 0 0));
  border: 1px solid var(--border, oklch(90% 0.006 250));
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.collection-card:hover {
  border-color: var(--accent, oklch(55% 0.16 25));
  box-shadow: 0 4px 12px color-mix(in oklch, var(--fg, oklch(20% 0.02 250)) 8%, transparent);
  transform: translateY(-1px);
}

.collection-card:active {
  transform: translateY(0);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg, oklch(20% 0.02 250));
  margin: 0;
  line-height: 1.3;
}

.slug-badge {
  font-size: 11px;
  font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, Menlo, monospace);
  padding: 2px 8px;
  background: var(--bg, oklch(98% 0.004 250));
  border: 1px solid var(--border, oklch(90% 0.006 250));
  border-radius: 4px;
  color: var(--muted, oklch(55% 0.015 250));
  flex-shrink: 0;
}

.card-desc {
  font-size: 13px;
  color: var(--muted, oklch(55% 0.015 250));
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border, oklch(90% 0.006 250));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.endpoint-count {
  font-size: 12px;
  color: var(--muted, oklch(55% 0.015 250));
}

.method-badges {
  display: flex;
  gap: 4px;
}

.method-badge {
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, Menlo, monospace);
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  text-transform: uppercase;
}

.doc-mode {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted, oklch(55% 0.015 250));
  font-weight: 500;
}

/* Skeleton */
.collection-card.skeleton {
  cursor: default;
  pointer-events: none;
}

.collection-card.skeleton:hover {
  border-color: var(--border, oklch(90% 0.006 250));
  box-shadow: none;
  transform: none;
}

.sk-title {
  width: 70%;
  height: 16px;
  background: var(--border, oklch(90% 0.006 250));
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
  background: linear-gradient(90deg, var(--border, oklch(90% 0.006 250)) 25%, var(--bg, oklch(98% 0.004 250)) 50%, var(--border, oklch(90% 0.006 250)) 75%);
  background-size: 200% 100%;
}

.sk-desc {
  width: 90%;
  height: 12px;
  background: var(--border, oklch(90% 0.006 250));
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
  background: linear-gradient(90deg, var(--border, oklch(90% 0.006 250)) 25%, var(--bg, oklch(98% 0.004 250)) 50%, var(--border, oklch(90% 0.006 250)) 75%);
  background-size: 200% 100%;
}

.sk-stats {
  width: 50%;
  height: 12px;
  background: var(--border, oklch(90% 0.006 250));
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
  background: linear-gradient(90deg, var(--border, oklch(90% 0.006 250)) 25%, var(--bg, oklch(98% 0.004 250)) 50%, var(--border, oklch(90% 0.006 250)) 75%);
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--muted, oklch(55% 0.015 250));
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg, oklch(20% 0.02 250));
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

/* List Error */
.list-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 20px;
  color: oklch(55% 0.16 25);
  font-size: 14px;
}

/* Direct Entry */
.direct-entry {
  margin-top: 16px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--muted, oklch(55% 0.015 250));
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border, oklch(90% 0.006 250));
}

.slug-box {
  display: flex;
  gap: 8px;
  max-width: 480px;
  margin: 0 auto;
}

.view-btn {
  padding: 10px 20px;
  border-radius: var(--radius, 8px);
  border: 1px solid transparent;
  background: var(--accent, oklch(55% 0.16 25));
  color: var(--surface, oklch(100% 0 0));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.view-btn:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent, oklch(55% 0.16 25)) 88%, black);
}

.view-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .api-docs-landing {
    padding: 20px;
  }

  .collections-grid {
    grid-template-columns: 1fr;
  }

  .slug-box {
    flex-direction: column;
  }

  .view-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk-title,
  .sk-desc,
  .sk-stats {
    animation: none;
    background: var(--border, oklch(90% 0.006 250));
  }
}
</style>
