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
  const params = new URLSearchParams();
  if (appFilter.value) params.set("app", appFilter.value);
  if (isEmbed.value) params.set("embed", "1");
  const q = params.toString();
  return q ? `/p/releases?${q}` : "/p/releases";
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

// Embed
const embedCopied = ref(false);
const embedCode = computed(() => {
  const url = `${useRequestURL().origin}/p/releases/${releaseId.value}${appFilter.value ? `?app=${appFilter.value}&embed=1` : `?embed=1`}`;
  return `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
});

async function copyEmbedCode() {
  try {
    await navigator.clipboard.writeText(embedCode.value);
    embedCopied.value = true;
    setTimeout(() => embedCopied.value = false, 2000);
  } catch {
    const input = document.createElement("input");
    input.value = embedCode.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    embedCopied.value = true;
    setTimeout(() => embedCopied.value = false, 2000);
  }
}
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
          <div class="rd-hero-meta">
            <span class="rd-hero-date">{{ formatDate(release.releaseDate) }}</span>
            <span v-if="release.type === 'article'" class="rd-hero-type">Article</span>
          </div>
        </div>
        <h1 class="rd-title">{{ release.heroTitle || `${release.appName} ${release.version}` }}</h1>
        <div class="rd-subtitle">
          <span class="rd-app">{{ release.appName }}</span>
          <span class="rd-version">{{ release.version }}</span>
        </div>
      </header>

      <!-- Body: article prose or fallback when no structured categories -->
      <div v-if="release.summary && (release.type === 'article' || !release.categories)" class="rd-body" v-html="renderMarkdown(release.summary)" />

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
        <button type="button" class="rd-embed-btn" @click="copyEmbedCode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span v-if="embedCopied">Copied</span>
          <span v-else>Copy embed code</span>
        </button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.rd {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

/* Loading / Empty */
.rd-empty {
  padding: 80px 0;
  text-align: center;
  color: var(--muted);
}
.rd-empty p {
  margin: 0;
  font-size: 16px;
}

/* Hero */
.rd-hero {
  text-align: center;
  margin-bottom: 48px;
  padding-top: 24px;
}
.rd-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
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
.rd-hero-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rd-hero-date {
  font-size: 13px;
  color: var(--muted);
}
.rd-hero-type {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: oklch(55% 0.14 300);
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in oklch, oklch(55% 0.14 300) 8%, transparent);
}
.rd-title {
  margin: 0 0 16px;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--fg);
}
.rd-subtitle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
  color: var(--muted);
}
.rd-app {
  font-weight: 500;
  color: var(--fg);
}
.rd-version {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  background: var(--fg-soft);
  border-radius: 4px;
}

/* Body */
.rd-body {
  font-size: 16px;
  line-height: 1.7;
  color: var(--fg);
}
.rd-body :deep(h2) {
  font-size: 26px;
  font-weight: 600;
  margin: 48px 0 20px;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--fg);
}
.rd-body :deep(h3) {
  font-size: 20px;
  font-weight: 600;
  margin: 32px 0 14px;
  line-height: 1.3;
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
  border-radius: 12px;
  margin: 32px 0;
  display: block;
}
.rd-body :deep(video) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 32px 0;
  display: block;
}
.rd-body :deep(ul) {
  padding-left: 24px;
  margin-bottom: 16px;
  list-style-type: disc;
}
.rd-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 16px;
  list-style-type: decimal;
}
.rd-body :deep(li) {
  margin-bottom: 8px;
}
.rd-body :deep(li:last-child) {
  margin-bottom: 0;
}
.rd-body :deep(blockquote) {
  margin: 32px 0;
  padding: 20px 24px;
  background: var(--fg-soft);
  border-radius: 12px;
  font-style: italic;
  color: var(--muted);
}
.rd-body :deep(pre) {
  margin: 32px 0;
  padding: 20px;
  background: var(--bg);
  border-radius: 12px;
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
.rd-body :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.rd-body :deep(a:hover) {
  text-decoration: underline;
}

/* Section */
.rd-section {
  margin-top: 48px;
  padding-top: 48px;
  border-top: 1px solid var(--border);
}
.rd-article > .rd-section:first-of-type {
  margin-top: 48px;
}
.rd-section-title {
  margin: 0 0 20px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg);
}
.rd-section-desc {
  font-size: 16px;
  line-height: 1.7;
  color: var(--muted);
  margin-bottom: 20px;
}

/* Tags */
.rd-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 6px;
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
  padding-left: 20px;
  margin-bottom: 10px;
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
  gap: 16px;
  margin-top: 20px;
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
  border-radius: 12px;
  display: block;
  object-fit: cover;
  aspect-ratio: 16 / 10;
}
.rd-media-item figcaption {
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}

/* Embed */
.rd-embed {
  margin-top: 64px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}
.rd-embed-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.rd-embed-btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}
.rd-embed-btn:active {
  transform: scale(0.98);
}
.rd-embed-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Responsive */
@media (max-width: 640px) {
  .rd-hero {
    padding-top: 16px;
    margin-bottom: 32px;
  }
  .rd-title {
    font-size: 26px;
    letter-spacing: -0.02em;
  }
  .rd-body {
    font-size: 15px;
  }
  .rd-body :deep(h2) {
    font-size: 22px;
    margin: 32px 0 16px;
  }
  .rd-body :deep(h3) {
    font-size: 18px;
    margin: 24px 0 12px;
  }
  .rd-body :deep(img),
  .rd-body :deep(video) {
    border-radius: 8px;
    margin: 24px 0;
  }
  .rd-section {
    margin-top: 32px;
    padding-top: 32px;
  }
  .rd-section-title {
    font-size: 18px;
  }
  .rd-media-2,
  .rd-media-3 {
    grid-template-columns: 1fr;
  }
  .rd-nav {
    margin-bottom: 24px;
  }
  .rd-hero-meta {
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rd-back,
  .rd-embed-btn {
    transition: none !important;
  }
}
</style>
