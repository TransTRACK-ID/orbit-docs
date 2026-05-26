<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ReleaseItem } from "~/types";

definePageMeta({
  layout: "public",
  auth: false,
});

const route = useRoute();
const releaseId = computed(() => route.params.id as string);

const release = ref<ReleaseItem | null>(null);
const isLoading = ref(true);

const appFilter = computed(() => route.query.app as string || "");
const isEmbed = computed(() => route.query.embed === "1" || route.query.embed === "true");

const backUrl = computed(() => {
  if (appFilter.value) return `/p/releases?app=${appFilter.value}`;
  return "/p/releases";
});

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

function formatDate(dateStr: string | null): string {
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

const categoryConfig: Record<string, { label: string; tagClass: string }> = {
  fixed: { label: "Fixed", tagClass: "rd-tag-fixed" },
  added: { label: "Added", tagClass: "rd-tag-added" },
  changed: { label: "Changed", tagClass: "rd-tag-changed" },
  deprecated: { label: "Deprecated", tagClass: "rd-tag-deprecated" },
  security: { label: "Security", tagClass: "rd-tag-security" },
};

// SEO
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
  <div class="rd">
    <!-- Loading / Empty -->
    <div v-if="isLoading" class="rd-empty">
      <p>Loading release…</p>
    </div>

    <div v-else-if="!release" class="rd-empty">
      <p>Release not found or not published.</p>
    </div>

    <article v-else class="rd-article">
      <!-- Hero -->
      <header class="rd-hero">
        <div class="rd-nav">
          <NuxtLink :to="backUrl" class="rd-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            All releases
          </NuxtLink>
          <span v-if="release.type === 'article'" class="rd-type">Article</span>
        </div>
        <h1 class="rd-title">{{ release.heroTitle || `${release.appName} ${release.version}` }}</h1>
        <div class="rd-meta">
          <span class="rd-app">{{ release.appName }}</span>
          <span class="rd-version">{{ release.version }}</span>
          <span class="rd-sep">·</span>
          <time class="rd-date">{{ formatDate(release.releaseDate) }}</time>
        </div>
      </header>

      <!-- Body -->
      <div v-if="release.summary" class="rd-body" v-html="renderMarkdown(release.summary)" />

      <!-- Features -->
      <section
        v-for="feature in release.features || []"
        :key="feature.id"
        class="rd-section"
      >
        <h2 class="rd-section-title">{{ feature.heading }}</h2>
        <p class="rd-section-desc">{{ feature.description }}</p>
        <div
          v-if="feature.media && feature.media.length > 0"
          class="rd-media"
          :class="{
            'rd-media-2': feature.media.length === 2,
            'rd-media-3': feature.media.length >= 3,
          }"
        >
          <figure
            v-for="(m, idx) in feature.media"
            :key="idx"
            class="rd-media-item"
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
          class="rd-section"
        >
          <h2 class="rd-section-title">
            <span class="rd-tag" :class="categoryConfig[key]?.tagClass || 'rd-tag-muted'">
              {{ categoryConfig[key]?.label || key }}
            </span>
          </h2>
          <ul class="rd-list">
            <li v-for="(item, idx) in items" :key="idx" v-html="item" />
          </ul>
        </section>
      </template>

      <!-- Embed -->
      <div v-if="!isEmbed" class="rd-embed">
        <span class="rd-embed-label">Embed this release</span>
        <code class="rd-embed-code">&lt;iframe src="{{ useRequestURL().origin }}/p/releases/{{ release.id }}{{ appFilter ? `?app=${appFilter}&amp;embed=1` : `?embed=1` }}" width="100%" height="600" frameborder="0"&gt;&lt;/iframe&gt;</code>
      </div>
    </article>
  </div>
</template>

<style scoped>
.rd {
  width: 100%;
}

/* Loading / Empty */
.rd-empty {
  padding: 64px 0;
  text-align: center;
  color: var(--muted);
}
.rd-empty p {
  margin: 0;
  font-size: 15px;
}

/* Hero */
.rd-hero {
  margin-bottom: 40px;
}
.rd-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.rd-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.rd-back:hover {
  color: var(--accent);
}
.rd-back svg {
  flex-shrink: 0;
}
.rd-type {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: oklch(55% 0.14 300);
}
.rd-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--fg);
}
.rd-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--muted);
}
.rd-app {
  font-weight: 500;
  color: var(--fg);
}
.rd-version {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 13px;
  padding: 2px 6px;
  background: var(--fg-soft);
  border-radius: 4px;
}
.rd-sep {
  color: var(--border);
}

/* Body */
.rd-body {
  font-size: 16px;
  line-height: 1.7;
  color: var(--fg);
}
.rd-body :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 40px 0 16px;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--fg);
}
.rd-body :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 28px 0 12px;
  line-height: 1.35;
  color: var(--fg);
}
.rd-body :deep(p) {
  margin-bottom: 16px;
}
.rd-body :deep(p:last-child) {
  margin-bottom: 0;
}
.rd-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 24px 0;
  display: block;
}
.rd-body :deep(video) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 24px 0;
  display: block;
}
.rd-body :deep(ul),
.rd-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 16px;
}
.rd-body :deep(li) {
  margin-bottom: 6px;
}
.rd-body :deep(li:last-child) {
  margin-bottom: 0;
}
.rd-body :deep(blockquote) {
  margin: 24px 0;
  padding: 16px 20px;
  background: var(--fg-soft);
  border-radius: 8px;
  font-style: italic;
  color: var(--muted);
}
.rd-body :deep(pre) {
  margin: 24px 0;
  padding: 16px;
  background: var(--bg);
  border-radius: 8px;
  overflow-x: auto;
}
.rd-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.rd-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.rd-body :deep(ul + p),
.rd-body :deep(ol + p),
.rd-body :deep(pre + p),
.rd-body :deep(blockquote + p) {
  margin-top: 16px;
}

/* Section */
.rd-section {
  padding-top: 48px;
  border-top: 1px solid var(--border);
}
.rd-article > .rd-section:first-of-type {
  margin-top: 48px;
}
.rd-section-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg);
}
.rd-section-desc {
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
  margin-bottom: 16px;
}

/* Tags */
.rd-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 4px;
}
.rd-tag-added {
  background: color-mix(in oklch, oklch(65% 0.14 145) 8%, transparent);
  color: oklch(50% 0.12 145);
}
.rd-tag-fixed {
  background: color-mix(in oklch, oklch(55% 0.14 255) 8%, transparent);
  color: oklch(45% 0.12 255);
}
.rd-tag-changed {
  background: color-mix(in oklch, oklch(70% 0.12 85) 8%, transparent);
  color: oklch(55% 0.10 85);
}
.rd-tag-deprecated {
  background: color-mix(in oklch, oklch(60% 0.14 300) 8%, transparent);
  color: oklch(50% 0.12 300);
}
.rd-tag-security {
  background: color-mix(in oklch, oklch(60% 0.14 25) 8%, transparent);
  color: oklch(50% 0.12 25);
}
.rd-tag-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

/* List */
.rd-list {
  padding-left: 0;
  list-style: none;
  margin: 0;
}
.rd-list li {
  position: relative;
  padding-left: 18px;
  margin-bottom: 8px;
  line-height: 1.6;
  color: var(--fg);
}
.rd-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.7em;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

/* Media */
.rd-media {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.rd-media-2 {
  grid-template-columns: repeat(2, 1fr);
}
.rd-media-3 {
  grid-template-columns: repeat(3, 1fr);
}
.rd-media-item img,
.rd-media-item video {
  width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  object-fit: cover;
  aspect-ratio: 16 / 10;
}
.rd-media-item figcaption {
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}

/* Embed */
.rd-embed {
  margin-top: 48px;
  padding: 20px;
  background: var(--fg-soft);
  border-radius: 8px;
}
.rd-embed-label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rd-embed-code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--fg);
  word-break: break-all;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 600px) {
  .rd-title {
    font-size: 22px;
    letter-spacing: -0.01em;
  }
  .rd-body {
    font-size: 15px;
  }
  .rd-section-title {
    font-size: 18px;
  }
  .rd-media-2,
  .rd-media-3 {
    grid-template-columns: 1fr;
  }
  .rd-meta {
    gap: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rd-back {
    transition: none !important;
  }
}
</style>
