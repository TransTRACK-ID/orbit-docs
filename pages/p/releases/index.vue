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
const isEmbed = computed(() => route.query.embed === "1" || route.query.embed === "true");

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
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

function stripMarkdown(text: string, maxLen = 280): string {
  if (!text) return "";
  const cleaned = text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).replace(/\s+[^\s]*$/, "") + "…";
}

// SEO
const pageTitle = computed(() => {
  if (appFilter.value) return `${appFilter.value} Release Notes`;
  return "Release Notes";
});

const pageDescription = computed(() => {
  const count = releases.value.length;
  if (appFilter.value) return `${count} published release${count === 1 ? "" : "s"} for ${appFilter.value}.`;
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
  <div class="rl">
    <!-- Header -->
    <header class="rl-head">
      <h1>{{ appFilter ? `${appFilter} Release Notes` : "Release Notes" }}</h1>
      <div v-if="!isEmbed" class="rl-search">
        <input
          v-model="search"
          type="text"
          placeholder="Search releases…"
          class="rl-search-input"
        />
      </div>
    </header>

    <!-- Loading / Empty -->
    <div v-if="isLoading" class="rl-empty">
      <p>Loading releases…</p>
    </div>

    <div v-else-if="filteredReleases.length === 0" class="rl-empty">
      <p v-if="search">No releases match your search.</p>
      <p v-else>No releases found.</p>
    </div>

    <!-- List -->
    <div v-else class="rl-list">
      <!-- Scoped to single app: flat timeline -->
      <template v-if="appFilter">
        <div class="rl-timeline">
          <article
            v-for="r in filteredReleases"
            :key="r.id"
            class="rl-item"
          >
            <NuxtLink :to="`/p/releases/${r.id}?app=${appFilter}`" class="rl-link">
              <div class="rl-meta">
                <span class="rl-version">{{ r.version }}</span>
                <span class="rl-sep">·</span>
                <time class="rl-time">{{ formatDate(r.releaseDate) }}</time>
                <span v-if="r.type === 'article'" class="rl-type">Article</span>
              </div>
              <h2 class="rl-title">{{ r.heroTitle || `${r.appName} ${r.version}` }}</h2>
              <p
                v-if="r.summary"
                class="rl-excerpt"
              >{{ stripMarkdown(r.summary) }}</p>
              <div class="rl-tags">
                <span v-if="countCategories(r.categories).added" class="rl-tag rl-tag-added">
                  {{ countCategories(r.categories).added }} added
                </span>
                <span v-if="countCategories(r.categories).fixed" class="rl-tag rl-tag-fixed">
                  {{ countCategories(r.categories).fixed }} fixed
                </span>
                <span v-if="countCategories(r.categories).changed" class="rl-tag rl-tag-changed">
                  {{ countCategories(r.categories).changed }} changed
                </span>
                <span v-if="countCategories(r.categories).security" class="rl-tag rl-tag-security">
                  {{ countCategories(r.categories).security }} security
                </span>
              </div>
            </NuxtLink>
          </article>
        </div>
      </template>

      <!-- All apps: grouped -->
      <template v-else>
        <section
          v-for="[appName, appReleases] in groupedByApp"
          :key="appName"
          class="rl-group"
        >
          <h2 class="rl-group-label">{{ appName }}</h2>
          <div class="rl-timeline">
            <article
              v-for="r in appReleases"
              :key="r.id"
              class="rl-item"
            >
              <NuxtLink :to="`/p/releases/${r.id}`" class="rl-link">
                <div class="rl-meta">
                  <span class="rl-version">{{ r.version }}</span>
                  <span class="rl-sep">·</span>
                  <time class="rl-time">{{ formatDate(r.releaseDate) }}</time>
                  <span v-if="r.type === 'article'" class="rl-type">Article</span>
                </div>
                <h3 class="rl-title">{{ r.heroTitle || `${r.appName} ${r.version}` }}</h3>
                <p
                  v-if="r.summary"
                  class="rl-excerpt"
                >{{ stripMarkdown(r.summary) }}</p>
                <div class="rl-tags">
                  <span v-if="countCategories(r.categories).added" class="rl-tag rl-tag-added">
                    {{ countCategories(r.categories).added }} added
                  </span>
                  <span v-if="countCategories(r.categories).fixed" class="rl-tag rl-tag-fixed">
                    {{ countCategories(r.categories).fixed }} fixed
                  </span>
                  <span v-if="countCategories(r.categories).changed" class="rl-tag rl-tag-changed">
                    {{ countCategories(r.categories).changed }} changed
                  </span>
                  <span v-if="countCategories(r.categories).security" class="rl-tag rl-tag-security">
                    {{ countCategories(r.categories).security }} security
                  </span>
                </div>
              </NuxtLink>
            </article>
          </div>
        </section>
      </template>
    </div>

    <!-- Embed code -->
    <div v-if="!isEmbed && appFilter" class="rl-embed">
      <span class="rl-embed-label">Embed this list</span>
      <code class="rl-embed-code">&lt;iframe src="{{ useRequestURL().origin }}/p/releases?app={{ appFilter }}&amp;embed=1" width="100%" height="800" frameborder="0"&gt;&lt;/iframe&gt;</code>
    </div>
  </div>
</template>

<style scoped>
.rl {
  width: 100%;
}

/* Header */
.rl-head {
  margin-bottom: 40px;
}
.rl-head h1 {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--fg);
}
.rl-search {
  max-width: 400px;
}
.rl-search-input {
  width: 100%;
  padding: 8px 0;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: var(--fg);
  transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rl-search-input::placeholder {
  color: var(--muted);
}
.rl-search-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Groups */
.rl-group {
  margin-bottom: 56px;
}
.rl-group:last-child {
  margin-bottom: 0;
}
.rl-group-label {
  margin: 0 0 24px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

/* Timeline */
.rl-timeline {
  display: flex;
  flex-direction: column;
}

/* Item */
.rl-item {
  position: relative;
  padding: 24px 0;
}
.rl-item:first-child {
  padding-top: 0;
}
.rl-item:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
.rl-item:last-child {
  padding-bottom: 0;
}
.rl-link {
  display: block;
  text-decoration: none;
  color: inherit;
}
.rl-link:hover .rl-title {
  color: var(--accent);
}

/* Meta */
.rl-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1;
  flex-wrap: wrap;
}
.rl-version {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--fg);
}
.rl-sep {
  color: var(--border);
}
.rl-time {
  color: var(--muted);
}
.rl-type {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: oklch(55% 0.14 300);
  margin-left: auto;
}

/* Title */
.rl-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--fg);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Excerpt */
.rl-excerpt {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0 0 10px;
}

/* Tags */
.rl-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rl-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 4px;
}
.rl-tag-added {
  background: color-mix(in oklch, oklch(65% 0.14 145) 8%, transparent);
  color: oklch(50% 0.12 145);
}
.rl-tag-fixed {
  background: color-mix(in oklch, oklch(55% 0.14 255) 8%, transparent);
  color: oklch(45% 0.12 255);
}
.rl-tag-changed {
  background: color-mix(in oklch, oklch(70% 0.12 85) 8%, transparent);
  color: oklch(55% 0.10 85);
}
.rl-tag-security {
  background: color-mix(in oklch, oklch(60% 0.14 25) 8%, transparent);
  color: oklch(50% 0.12 25);
}

/* Empty */
.rl-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--muted);
}
.rl-empty p {
  margin: 0;
  font-size: 15px;
}

/* Embed */
.rl-embed {
  margin-top: 48px;
  padding: 20px;
  background: var(--fg-soft);
  border-radius: 8px;
}
.rl-embed-label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rl-embed-code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--fg);
  word-break: break-all;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 600px) {
  .rl-head h1 {
    font-size: 22px;
    letter-spacing: -0.01em;
  }
  .rl-item {
    padding: 20px 0;
  }
  .rl-title {
    font-size: 16px;
  }
  .rl-meta {
    gap: 6px;
  }
  .rl-type {
    margin-left: 0;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rl-link:hover .rl-title {
    transition: none;
  }
}
</style>
