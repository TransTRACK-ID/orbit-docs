<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ReleaseItem } from "~/types";

definePageMeta({
  layout: "public",
  auth: false,
});

const route = useRoute();
const search = ref("");
const releases = ref<ReleaseItem[]>([]);
const isLoading = ref(true);

const appFilter = computed(() => route.query.app as string || "");

async function load() {
  isLoading.value = true;
  try {
    const data = await $fetch<{ data: ReleaseItem[] }>("/api/public/releases", {
      query: { app: appFilter.value, limit: "100" },
    });
    releases.value = data.data;
  } catch (e) {
    console.error("Failed to load releases", e);
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);

const filteredReleases = computed(() => {
  if (!search.value.trim()) return releases.value;
  const q = search.value.toLowerCase();
  return releases.value.filter((r) => {
    const text = [r.appName, r.version, r.heroTitle, r.summary].filter(Boolean).join(" ").toLowerCase();
    return text.includes(q);
  });
});

const groupedByApp = computed(() => {
  const map = new Map<string, ReleaseItem[]>();
  for (const r of filteredReleases.value) {
    const list = map.get(r.appName) || [];
    list.push(r);
    map.set(r.appName, list);
  }
  return map;
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function countCategories(categories: any) {
  return {
    added: categories?.added?.length || 0,
    fixed: categories?.fixed?.length || 0,
    changed: categories?.changed?.length || 0,
    deprecated: categories?.deprecated?.length || 0,
    security: categories?.security?.length || 0,
  };
}

function mediaCount(r: ReleaseItem) {
  return (r.features || []).reduce((acc, f) => acc + (f.media?.length || 0), 0);
}

// SEO
const pageTitle = computed(() => {
  if (appFilter.value) return `Releases for ${appFilter.value}`;
  return "Release Notes";
});

const pageDescription = computed(() => {
  const count = releases.value.length;
  if (appFilter.value) return `${count} published releases for ${appFilter.value}.`;
  return `Browse ${count} published release notes.`;
});

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: "website",
  twitterCard: "summary",
});

// JSON-LD structured data
watch(releases, (list) => {
  if (!list.length) return;
  const items = list.slice(0, 20).map((r) => ({
    "@type": "SoftwareApplication",
    name: r.appName,
    softwareVersion: r.version,
    datePublished: r.releaseDate,
    description: r.heroTitle || r.summary || undefined,
    url: `${useRequestURL().origin}/p/releases/${r.id}`,
  }));
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item,
    })),
  });
  useHead({
    script: [
      {
        type: "application/ld+json",
        innerHTML: jsonLd,
      },
    ],
  });
}, { immediate: true });
</script>

<template>
  <div class="public-releases">
    <div class="public-hero">
      <h1>{{ appFilter ? `${appFilter} Releases` : "Release Notes" }}</h1>
      <p class="public-subtitle">
        {{ releases.length }} published release{{ releases.length === 1 ? "" : "s" }}
      </p>
    </div>

    <div class="public-search">
      <input
        v-model="search"
        type="text"
        placeholder="Search releases…"
        class="public-search-input"
      />
    </div>

    <div v-if="isLoading" class="public-loading">
      <p>Loading releases…</p>
    </div>

    <div v-else-if="filteredReleases.length === 0" class="public-empty">
      <p>No releases found.</p>
    </div>

    <div v-else class="public-app-groups">
      <section
        v-for="[appName, appReleases] in groupedByApp"
        :key="appName"
        class="public-app-section"
      >
        <h2 class="public-app-name">{{ appName }}</h2>
        <div class="public-release-list">
          <article
            v-for="r in appReleases"
            :key="r.id"
            class="public-release-card"
          >
            <NuxtLink :to="`/p/releases/${r.id}`" class="public-release-link">
              <div class="public-release-header">
                <span class="public-version">{{ r.version }}</span>
                <span v-if="r.type === 'article'" class="pill pill-purple">Article</span>
                <span class="public-date">{{ formatDate(r.releaseDate) }}</span>
              </div>
              <h3 class="public-release-title">{{ r.heroTitle || `${r.appName} ${r.version}` }}</h3>
              <div
                v-if="r.summary"
                class="public-release-summary"
                v-html="renderMarkdown(r.summary)"
              />
              <div class="public-release-meta">
                <span v-if="countCategories(r.categories).added" class="pill pill-green">
                  {{ countCategories(r.categories).added }} added
                </span>
                <span v-if="countCategories(r.categories).fixed" class="pill pill-blue">
                  {{ countCategories(r.categories).fixed }} fixed
                </span>
                <span v-if="countCategories(r.categories).changed" class="pill pill-amber">
                  {{ countCategories(r.categories).changed }} changed
                </span>
                <span v-if="countCategories(r.categories).security" class="pill pill-red">
                  {{ countCategories(r.categories).security }} security
                </span>
                <span v-if="mediaCount(r) > 0" class="pill pill-muted">
                  {{ mediaCount(r) }} media
                </span>
              </div>
            </NuxtLink>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.public-releases {
  width: 100%;
}
.public-hero {
  margin-bottom: 24px;
}
.public-hero h1 {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fg);
}
.public-subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 15px;
}
.public-search {
  margin-bottom: 24px;
}
.public-search-input {
  width: 100%;
  max-width: 400px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
}
.public-search-input:focus {
  outline: none;
  border-color: var(--accent);
}
.public-app-section {
  margin-bottom: 32px;
}
.public-app-name {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}
.public-release-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.public-release-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.public-release-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.06);
}
.public-release-link {
  display: block;
  padding: 20px;
  text-decoration: none;
  color: inherit;
}
.public-release-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.public-version {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg);
}
.public-date {
  font-size: 13px;
  color: var(--muted);
}
.public-release-title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
}
.public-release-summary {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 12px;
  max-height: 80px;
  overflow: hidden;
}
.public-release-summary :deep(p) {
  margin: 0 0 6px;
}
.public-release-summary :deep(*:last-child) {
  margin-bottom: 0;
}
.public-release-summary :deep(img) {
  max-height: 60px;
  border-radius: 4px;
}
.public-release-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.public-loading,
.public-empty {
  padding: 40px 0;
  text-align: center;
  color: var(--muted);
}
</style>
