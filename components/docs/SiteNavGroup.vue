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
  <li v-if="visible" :class="depth === 1 ? 'site-nav-domain' : 'site-nav-group'">
    <div
      :class="depth === 1
        ? 'site-nav-domain-label'
        : ['site-nav-group-label', { 'site-nav-group-label--deep': depth >= 3 }]"
    >
      {{ group.label }}
    </div>
    <ul v-if="publishedSlugs(group.pages).length" class="site-nav-links" role="list">
      <li v-for="slug in publishedSlugs(group.pages)" :key="`${group.id}-${slug}`">
        <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
          {{ pageTitle(slug) }}
          <span
            v-if="showStatus && pageStatusLabel(slug)"
            class="site-nav-status"
          >{{ pageStatusLabel(slug) }}</span>
        </NuxtLink>
      </li>
    </ul>
    <ul v-if="group.groups?.length" class="site-nav-subgroups" role="list">
      <SiteNavGroup
        v-for="sub in group.groups"
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
/* Level 1: domain. A label, never a row: mono eyebrow per DESIGN.md label
   token, separated from the previous domain by space + hairline. */
.site-nav-domain {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.site-nav-domain:first-child {
  margin-top: 2px;
  padding-top: 0;
  border-top: none;
}

.site-nav-domain-label {
  padding: 0 10px;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
  color: color-mix(in oklch, var(--muted) 82%, var(--fg));
  cursor: default;
}

/* Level 2+: section. Still a label, not a row: sans semibold in ink, no
   box, no hover. Hierarchy comes from type + spacing, not indentation,
   so depth never eats sidebar width. */
.site-nav-group {
  margin-top: 16px;
}

.site-nav-domain-label + .site-nav-links,
.site-nav-domain-label + .site-nav-subgroups > .site-nav-group:first-child {
  margin-top: 0;
}

.site-nav-group-label {
  padding: 0 10px;
  margin-bottom: 3px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
  color: var(--fg);
  cursor: default;
}

.site-nav-group-label--deep {
  font-size: 12px;
  color: color-mix(in oklch, var(--fg) 78%, var(--muted));
}

.site-nav-subgroups {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Pages: the only interactive rows. Box states (hover, focus, active
   pill) exist here and nowhere else in the tree. */
.site-nav-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.site-nav-links :deep(a) {
  display: block;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: break-word;
  border-radius: 8px;
  color: color-mix(in oklch, var(--muted) 88%, var(--fg));
  text-decoration: none;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.site-nav-links :deep(a:hover) {
  color: var(--fg);
  background: var(--fg-soft);
}

.site-nav-links :deep(a:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  color: var(--fg);
}

.site-nav-links :deep(a.active) {
  color: var(--accent);
  font-weight: 550;
  background: var(--accent-soft);
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
