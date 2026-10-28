<script setup lang="ts">
import type { NavGroup } from "~/server/database/schema";
import { navGroupHasVisiblePages } from "~/utils/nav-client";
import SiteNavGroup from "./SiteNavGroup.vue";

const props = defineProps<{
  group: NavGroup;
  depth: number;
  pageTitles: Map<string, string>;
  pageStatuses: Map<string, string>;
  publishedSlugSet: Set<string>;
  basePath: string;
  activePageSlug: string;
  showStatus: boolean;
}>();

const visible = computed(() => navGroupHasVisiblePages(props.group, props.publishedSlugSet));

function pageTitle(slug: string): string {
  return props.pageTitles.get(slug) || slug;
}

function pageStatusLabel(slug: string): string {
  const status = props.pageStatuses.get(slug);
  if (!status || status === "published") return "";
  if (status === "in_review") return "In review";
  return status;
}

function href(slug: string): string {
  return `${props.basePath}/${slug}`;
}

function isActive(slug: string): boolean {
  return slug === props.activePageSlug;
}

function publishedSlugs(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs.filter((s) => props.publishedSlugSet.has(s));
}
</script>

<template>
  <li
    v-if="visible"
    :class="depth === 1 ? 'site-nav-section' : 'site-nav-nested'"
    :style="depth > 1 ? { marginInlineStart: '12px' } : undefined"
  >
    <div :class="depth === 1 ? 'site-nav-section-title' : 'site-nav-nested-title'">
      {{ group.label }}
    </div>
    <ul class="site-nav-links" role="list">
      <li v-for="slug in publishedSlugs(group.pages)" :key="`${group.id}-${slug}`">
        <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
          {{ pageTitle(slug) }}
          <span
            v-if="showStatus && pageStatusLabel(slug)"
            class="site-nav-status"
          >{{ pageStatusLabel(slug) }}</span>
        </NuxtLink>
      </li>
      <SiteNavGroup
        v-for="sub in group.groups || []"
        :key="sub.id"
        :group="sub"
        :depth="depth + 1"
        :page-titles="pageTitles"
        :page-statuses="pageStatuses"
        :published-slug-set="publishedSlugSet"
        :base-path="basePath"
        :active-page-slug="activePageSlug"
        :show-status="showStatus"
      />
    </ul>
  </li>
</template>

<style scoped>
.site-nav-section {
  margin-top: 20px;
}

.site-nav-section:first-child {
  margin-top: 4px;
}

.site-nav-section-title {
  padding: 0 12px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted);
}

.site-nav-links {
  list-style: none;
  margin: 0;
  padding: 0;
}

.site-nav-links :deep(a) {
  display: block;
  margin: 0 2px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  border-radius: 8px;
  color: color-mix(in oklch, var(--muted) 90%, var(--fg));
  text-decoration: none;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.site-nav-links :deep(a:hover) {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 6%, transparent);
}

.site-nav-links :deep(a.active) {
  color: var(--accent);
  font-weight: 500;
  background: color-mix(in oklch, var(--accent) 8%, transparent);
}

.site-nav-nested {
  margin-top: 8px;
}

.site-nav-nested-title {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
}

.site-nav-status {
  margin-left: 6px;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 999px;
  vertical-align: middle;
  background: color-mix(in oklch, oklch(65% 0.14 85) 20%, transparent);
  color: oklch(48% 0.12 85);
}
</style>
