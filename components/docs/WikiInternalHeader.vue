<script setup lang="ts">
import { useWikiPageMeta } from "~/composables/useWikiPageMeta";

const props = defineProps<{
  siteName: string;
  siteSlug: string;
  siteId: string;
  siteStatus: string;
}>();

const wikiPageMeta = useWikiPageMeta();
const pageId = computed(() => wikiPageMeta.value.pageId);
</script>

<template>
  <header class="wiki-internal-header">
    <div class="wiki-internal-header-left">
      <NuxtLink to="/docs" class="wiki-internal-back">← Docs</NuxtLink>
      <span class="wiki-internal-divider" aria-hidden="true">/</span>
      <NuxtLink :to="`/sites/${siteId}`" class="wiki-internal-site">{{ siteName }}</NuxtLink>
      <span class="wiki-internal-label">Internal wiki</span>
    </div>
    <div class="wiki-internal-header-right">
      <NuxtLink
        v-if="pageId"
        :to="`/docs/${pageId}`"
        class="wiki-internal-edit"
      >
        Edit page
      </NuxtLink>
      <NuxtLink :to="`/docs?siteId=${siteId}`" class="wiki-internal-list">
        All pages
      </NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.wiki-internal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--surface) 92%, var(--bg));
  font-size: 13px;
}

.wiki-internal-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.wiki-internal-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.wiki-internal-back,
.wiki-internal-site,
.wiki-internal-edit,
.wiki-internal-list {
  color: var(--muted);
  text-decoration: none;
}

.wiki-internal-back:hover,
.wiki-internal-site:hover,
.wiki-internal-edit:hover,
.wiki-internal-list:hover {
  color: var(--accent);
}

.wiki-internal-site {
  font-weight: 600;
  color: var(--fg);
}

.wiki-internal-divider {
  color: var(--muted);
  opacity: 0.5;
}

.wiki-internal-label {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.02em;
  background: color-mix(in oklch, var(--accent) 12%, transparent);
  color: var(--accent);
}

.wiki-internal-edit {
  font-weight: 500;
}
</style>
