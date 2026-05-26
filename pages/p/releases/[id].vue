<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ReleaseItem, ReleaseFeature } from "~/types";

definePageMeta({
  layout: "public",
  auth: false,
});

const route = useRoute();
const releaseId = computed(() => route.params.id as string);

const release = ref<ReleaseItem | null>(null);
const isLoading = ref(true);

onMounted(async () => {
  if (!releaseId.value) return;
  isLoading.value = true;
  try {
    const data = await $fetch<{ data: ReleaseItem }>(`/api/public/releases/${releaseId.value}`);
    release.value = data.data;
  } catch (e) {
    console.error("Failed to load release", e);
  } finally {
    isLoading.value = false;
  }
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function countCategories(categories: any) {
  return {
    fixed: categories?.fixed || [],
    added: categories?.added || [],
    changed: categories?.changed || [],
    deprecated: categories?.deprecated || [],
    security: categories?.security || [],
  };
}

const categoryConfig: Record<string, { label: string; pillClass: string }> = {
  fixed: { label: "Fixed", pillClass: "pill-blue" },
  added: { label: "Added", pillClass: "pill-green" },
  changed: { label: "Changed", pillClass: "pill-amber" },
  deprecated: { label: "Deprecated", pillClass: "pill-purple" },
  security: { label: "Security", pillClass: "pill-red" },
};

// SEO
const pageTitle = computed(() => {
  if (!release.value) return "Release Notes";
  return `${release.value.heroTitle || `${release.value.appName} ${release.value.version}`}`;
});

const pageDescription = computed(() => {
  if (!release.value) return "Release not found";
  const cats = countCategories(release.value.categories);
  const catSummary = [cats.added.length && `${cats.added.length} added`, cats.fixed.length && `${cats.fixed.length} fixed`, cats.changed.length && `${cats.changed.length} changed`].filter(Boolean).join(", ");
  return `${release.value.appName} ${release.value.version}: ${catSummary || "Latest release notes"}`;
});

useSeoMeta({
  title: computed(() => release.value ? `${release.value.heroTitle || `${release.value.appName} ${release.value.version}`}` : "Release Notes"),
  description: computed(() => release.value
    ? `${release.value.appName} ${release.value.version}: Latest release notes`
    : "Release not found"),
  ogTitle: computed(() => release.value ? `${release.value.heroTitle || `${release.value.appName} ${release.value.version}`}` : "Release Notes"),
  ogDescription: computed(() => release.value
    ? `${release.value.appName} ${release.value.version}: Latest release notes`
    : "Release not found"),
  ogType: "article",
  twitterCard: "summary_large_image",
});

// JSON-LD
watch(release, (r) => {
  if (!r) return;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: r.appName,
    softwareVersion: r.version,
    datePublished: r.releaseDate,
    description: r.heroTitle || r.summary || undefined,
    author: r.createdBy ? { "@type": "Person", name: r.createdBy } : undefined,
    url: `${useRequestURL().origin}/p/releases/${r.id}`,
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
  <div class="public-release">
    <div v-if="isLoading" class="public-loading">
      <p>Loading release…</p>
    </div>

    <div v-else-if="!release" class="public-empty">
      <p>Release not found or not published.</p>
    </div>

    <article v-else class="public-release-article">
      <header class="public-release-hero">
        <div class="public-release-meta-bar">
          <NuxtLink to="/p/releases" class="public-back">← All releases</NuxtLink>
          <span class="pill" :class="release.type === 'article' ? 'pill-purple' : 'pill-muted'">
            {{ release.type === 'article' ? 'Article' : 'Normal' }}
          </span>
        </div>
        <h1>{{ release.heroTitle || `${release.appName} ${release.version}` }}</h1>
        <div class="public-release-sub">
          <span class="public-app">{{ release.appName }}</span>
          <span class="public-version-badge">{{ release.version }}</span>
          <span class="public-date">{{ formatDate(release.releaseDate) }}</span>
        </div>
      </header>

      <!-- Article body -->
      <div v-if="release.summary" class="public-body" v-html="renderMarkdown(release.summary)" />

      <!-- Features -->
      <section
        v-for="feature in release.features || []"
        :key="feature.id"
        class="public-feature"
      >
        <h2>{{ feature.heading }}</h2>
        <p>{{ feature.description }}</p>
        <div
          v-if="feature.media && feature.media.length > 0"
          class="public-media-grid"
          :class="feature.media.length === 2 ? 'public-media-grid-2' : feature.media.length >= 3 ? 'public-media-grid-3' : ''"
        >
          <figure
            v-for="(m, idx) in feature.media"
            :key="idx"
            class="public-media-item"
          >
            <img v-if="m.type === 'image' && m.src" :src="m.src" :alt="m.alt || ''" loading="lazy" />
            <video v-else-if="m.type === 'video' && m.src" :src="m.src" controls preload="metadata" />
            <figcaption v-if="m.alt">{{ m.alt }}</figcaption>
          </figure>
        </div>
      </section>

      <!-- Categories -->
      <template v-if="release.categories">
        <section
          v-for="[key, items] in Object.entries(countCategories(release.categories)).filter(([, v]) => v.length > 0)"
          :key="key"
          class="public-changes-section"
        >
          <h3>
            <span class="pill" :class="categoryConfig[key]?.pillClass || 'pill-muted'">
              {{ categoryConfig[key]?.label || key }}
            </span>
          </h3>
          <ul>
            <li v-for="(item, idx) in items" :key="idx" v-html="item" />
          </ul>
        </section>
      </template>

      <!-- Embed link -->
      <div class="public-embed-bar">
        <span class="text-muted-sm">Embed this release</span>
        <code class="public-embed-code">&lt;iframe src="{{ useRequestURL().origin }}/p/releases/{{ release.id }}" width="100%" height="600" frameborder="0"&gt;&lt;/iframe&gt;</code>
      </div>
    </article>
  </div>
</template>

<style scoped>
.public-release {
  width: 100%;
}
.public-loading,
.public-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--muted);
}
.public-release-hero {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.public-release-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.public-back {
  text-decoration: none;
  color: var(--muted);
  font-size: 14px;
}
.public-back:hover {
  color: var(--accent);
}
.public-release-hero h1 {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--fg);
}
.public-release-sub {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--muted);
}
.public-app {
  font-weight: 500;
  color: var(--text);
}
.public-version-badge {
  padding: 2px 8px;
  background: var(--bg);
  border-radius: 4px;
  font-weight: 500;
  font-size: 13px;
}
.public-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--fg);
  margin-bottom: 32px;
}
.public-body :deep(h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 32px 0 16px;
  letter-spacing: -0.01em;
}
.public-body :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 24px 0 12px;
}
.public-body :deep(p) {
  margin-bottom: 16px;
}
.public-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}
.public-body :deep(video) {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}
.public-body :deep(ul) {
  padding-left: 24px;
  margin-bottom: 16px;
}
.public-body :deep(li) {
  margin-bottom: 6px;
}
.public-body :deep(blockquote) {
  margin: 24px 0;
  padding: 12px 20px;
  border-left: 3px solid var(--accent);
  background: var(--bg);
  border-radius: 0 8px 8px 0;
  font-style: italic;
}
.public-body :deep(pre) {
  margin: 24px 0;
  padding: 16px;
  background: var(--bg);
  border-radius: 8px;
  overflow-x: auto;
}
.public-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.public-feature {
  margin: 32px 0;
  padding: 24px 0;
  border-top: 1px solid var(--border);
}
.public-feature h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
}
.public-feature p {
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
  margin-bottom: 16px;
}
.public-media-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.public-media-grid-2 {
  grid-template-columns: repeat(2, 1fr);
}
.public-media-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}
.public-media-item img,
.public-media-item video {
  width: 100%;
  border-radius: 8px;
}
.public-media-item figcaption {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}
.public-changes-section {
  margin: 24px 0;
}
.public-changes-section h3 {
  margin-bottom: 12px;
}
.public-changes-section ul {
  padding-left: 20px;
}
.public-changes-section li {
  margin-bottom: 6px;
  line-height: 1.5;
}
.public-embed-bar {
  margin-top: 40px;
  padding: 16px;
  background: var(--bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.public-embed-bar span {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
}
.public-embed-code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
}
@media (max-width: 600px) {
  .public-media-grid-2,
  .public-media-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
