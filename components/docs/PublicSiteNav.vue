<script setup lang="ts">
import type { NavConfig, NavGroup, NavOpenApiOperation } from "~/server/database/schema";
import {
  resolveFallbackPageSlugs,
  slugify,
  unlistedPublishedSlugs,
} from "~/utils/nav-client";

const props = defineProps<{
  navConfig: NavConfig | null;
  siteSlug: string;
  pages: Array<{ slug: string | null; title: string }>;
  activePageSlug: string;
  activeOperationSlug?: string;
  openapiOperations?: NavOpenApiOperation[];
}>();

const pageTitles = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.pages) {
    if (p.slug) map.set(p.slug, p.title);
  }
  return map;
});

const publishedSlugSet = computed(() => {
  const set = new Set<string>();
  for (const p of props.pages) {
    if (p.slug) set.add(p.slug);
  }
  return set;
});

function pageTitle(slug: string): string {
  return pageTitles.value.get(slug) || slug;
}

function href(slug: string): string {
  return `/s/${props.siteSlug}/${slug}`;
}

function operationHref(slug: string): string {
  return `/s/${props.siteSlug}/api/${slug}`;
}

function isActive(slug: string): boolean {
  return slug === props.activePageSlug;
}

function isOperationActive(slug: string): boolean {
  return slug === props.activeOperationSlug;
}

function publishedSlugs(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs.filter((s) => publishedSlugSet.value.has(s));
}

function groupHasPages(group: NavGroup): boolean {
  if (publishedSlugs(group.pages).length > 0) return true;
  return (group.groups || []).some((sub) => groupHasPages(sub));
}

const navListedPageSlugs = computed(() => publishedSlugs(props.navConfig?.pages));

const fallbackPageSlugs = computed(() =>
  resolveFallbackPageSlugs(props.navConfig, props.pages),
);

const unlistedPageSlugs = computed(() => {
  if (fallbackPageSlugs.value.length > 0) return [];
  return unlistedPublishedSlugs(props.navConfig, props.pages);
});

/** Top-level nav pages + any published pages not elsewhere in the nav tree. */
const pagesSectionSlugs = computed(() => {
  if (fallbackPageSlugs.value.length > 0) return [];
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const slug of [...navListedPageSlugs.value, ...unlistedPageSlugs.value]) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
});

const showPagesSection = computed(() => pagesSectionSlugs.value.length > 0);

const operationsByTag = computed(() => {
  const ops = props.openapiOperations?.length
    ? props.openapiOperations
    : (props.navConfig?.openapi || []);
  const groups = new Map<string, NavOpenApiOperation[]>();
  for (const op of ops) {
    const tag = op.tag || "API";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag)!.push(op);
  }
  return [...groups.entries()].map(([tag, items]) => ({ tag, items }));
});

const apiOperationCount = computed(() =>
  operationsByTag.value.reduce((sum, g) => sum + g.items.length, 0),
);

const hasDocNav = computed(
  () =>
    pagesSectionSlugs.value.length > 0
    || fallbackPageSlugs.value.length > 0
    || (props.navConfig?.groups || []).some((g) => groupHasPages(g)),
);

const hasAnyNavItems = computed(
  () =>
    hasDocNav.value
    || operationsByTag.value.length > 0
    || (props.navConfig?.external?.length ?? 0) > 0,
);

const apiExpanded = ref(!!props.activeOperationSlug);
const expandedTags = ref<Set<string>>(new Set());

function tagForActiveOperation(): string | null {
  if (!props.activeOperationSlug) return null;
  for (const group of operationsByTag.value) {
    if (group.items.some((op) => op.slug === props.activeOperationSlug)) {
      return group.tag;
    }
  }
  return null;
}

function syncApiExpansion() {
  const activeTag = tagForActiveOperation();
  if (activeTag) {
    apiExpanded.value = true;
    expandedTags.value = new Set([activeTag]);
  }
}

function toggleApiSection() {
  apiExpanded.value = !apiExpanded.value;
}

function toggleTag(tag: string) {
  const next = new Set(expandedTags.value);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  expandedTags.value = next;
}

function isTagExpanded(tag: string): boolean {
  return expandedTags.value.has(tag);
}

onMounted(syncApiExpansion);
watch(() => props.activeOperationSlug, syncApiExpansion);

const METHOD_COLORS: Record<string, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
};

function tagPanelId(tag: string): string {
  return `site-nav-tag-${slugify(tag) || "api"}`;
}
function methodClass(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] || "method-other";
}
</script>

<template>
  <nav class="site-nav" aria-label="Site navigation">
    <p v-if="!hasAnyNavItems" class="site-nav-empty">No pages published yet.</p>

    <ul v-else class="doc-nav doc-nav--site" role="list">
      <template v-for="group in navConfig?.groups || []" :key="group.id">
        <li v-if="groupHasPages(group)" class="site-nav-group">
          <div class="site-nav-group-label">{{ group.label }}</div>
          <ul class="doc-nav doc-nav--nested" role="list">
            <li v-for="slug in publishedSlugs(group.pages)" :key="`${group.id}-${slug}`">
              <NuxtLink :to="href(slug)" class="indent" :class="{ active: isActive(slug) }">
                {{ pageTitle(slug) }}
              </NuxtLink>
            </li>
            <template v-for="sub in group.groups || []" :key="sub.id">
              <li v-if="groupHasPages(sub)" class="site-nav-subgroup">
                <div class="site-nav-subgroup-label">{{ sub.label }}</div>
                <ul class="doc-nav doc-nav--nested" role="list">
                  <li v-for="slug in publishedSlugs(sub.pages)" :key="`${sub.id}-${slug}`">
                    <NuxtLink
                      :to="href(slug)"
                      class="indent indent--deep"
                      :class="{ active: isActive(slug) }"
                    >
                      {{ pageTitle(slug) }}
                    </NuxtLink>
                  </li>
                </ul>
              </li>
            </template>
          </ul>
        </li>
      </template>

      <li v-if="showPagesSection" class="site-nav-group" :class="{ 'site-nav-group--docs': operationsByTag.length > 0 }">
        <div class="site-nav-group-label">Pages</div>
        <ul class="doc-nav doc-nav--nested" role="list">
          <li v-for="slug in pagesSectionSlugs" :key="`page-${slug}`">
            <NuxtLink :to="href(slug)" class="indent" :class="{ active: isActive(slug) }">
              {{ pageTitle(slug) }}
            </NuxtLink>
          </li>
        </ul>
      </li>

      <template v-if="fallbackPageSlugs.length">
        <li v-for="slug in fallbackPageSlugs" :key="`fallback-${slug}`">
          <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
            {{ pageTitle(slug) }}
          </NuxtLink>
        </li>
      </template>

      <li
        v-if="operationsByTag.length"
        class="site-nav-group site-nav-group--api"
        :class="{ 'site-nav-group--api-first': hasDocNav }"
      >
        <button
          type="button"
          class="site-nav-collapse-trigger"
          :aria-expanded="apiExpanded"
          aria-controls="site-nav-api-panel"
          @click="toggleApiSection"
        >
          <span class="site-nav-collapse-label">
            <span class="site-nav-group-label site-nav-group-label--inline">API Reference</span>
            <span class="site-nav-count">{{ apiOperationCount }}</span>
          </span>
          <span class="site-nav-chevron" :class="{ 'is-expanded': apiExpanded }" aria-hidden="true" />
        </button>

        <div
          v-show="apiExpanded"
          id="site-nav-api-panel"
          class="site-nav-api-panel"
        >
          <div
            v-for="group in operationsByTag"
            :key="`oa-${group.tag}`"
            class="site-nav-api-tag"
          >
            <button
              type="button"
              class="site-nav-tag-trigger"
              :aria-expanded="isTagExpanded(group.tag)"
              :aria-controls="tagPanelId(group.tag)"
              @click="toggleTag(group.tag)"
            >
              <span class="site-nav-tag-label">{{ group.tag }}</span>
              <span class="site-nav-count site-nav-count--sub">{{ group.items.length }}</span>
              <span
                class="site-nav-chevron site-nav-chevron--sm"
                :class="{ 'is-expanded': isTagExpanded(group.tag) }"
                aria-hidden="true"
              />
            </button>

            <ul
              v-show="isTagExpanded(group.tag)"
              :id="tagPanelId(group.tag)"
              class="doc-nav doc-nav--nested"
              role="list"
            >
              <li v-for="op in group.items" :key="`oa-${op.slug}`">
                <NuxtLink
                  :to="operationHref(op.slug)"
                  class="site-nav-op indent"
                  :class="{ active: isOperationActive(op.slug) }"
                >
                  <span class="method-badge" :class="methodClass(op.method)">{{ op.method }}</span>
                  <span class="site-nav-op-label">{{ op.label }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </li>

      <li v-for="link in navConfig?.external || []" :key="link.id">
        <a :href="link.url" class="site-nav-external" target="_blank" rel="noopener">
          {{ link.label }}
          <span class="site-nav-external-icon" aria-hidden="true">↗</span>
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.site-nav {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.site-nav-empty {
  margin: 16px 20px;
  font-size: 13px;
  color: var(--muted);
}

.doc-nav--site {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 8px;
  padding-bottom: 24px;
  overscroll-behavior: contain;
}

.doc-nav--nested {
  padding: 0;
  gap: 0;
}

.site-nav-group {
  margin-top: 8px;
}

.site-nav-group--api,
.site-nav-group--docs {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
}

.site-nav-group-label {
  padding: 8px 12px 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}

.site-nav-group-label--inline {
  padding: 0;
}

.site-nav-collapse-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
  border-radius: 6px;
}

.site-nav-collapse-trigger:hover {
  background: color-mix(in oklch, var(--fg) 5%, transparent);
}

.site-nav-collapse-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
}

.site-nav-collapse-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-nav-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--fg) 6%, transparent);
}

.site-nav-count--sub {
  margin-left: auto;
  margin-right: 6px;
}

.site-nav-chevron {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--muted);
  border-bottom: 1.5px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.site-nav-chevron--sm {
  width: 6px;
  height: 6px;
}

.site-nav-chevron.is-expanded {
  transform: rotate(45deg);
}

@media (prefers-reduced-motion: reduce) {
  .site-nav-chevron {
    transition: none;
  }
}

.site-nav-api-panel {
  max-height: min(52vh, 480px);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 4px 4px;
  padding-bottom: 4px;
}

.site-nav-api-tag + .site-nav-api-tag {
  margin-top: 2px;
}

.site-nav-tag-trigger {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px 6px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: var(--muted);
  text-align: left;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.site-nav-tag-trigger:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 5%, transparent);
}

.site-nav-tag-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
}

.site-nav-tag-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-nav-subgroup {
  margin-top: 4px;
}

.site-nav-subgroup-label {
  padding: 4px 12px 4px 20px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}

.site-nav-external {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  border-radius: 6px;
}

.site-nav-external:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 7%, transparent);
}

.site-nav-external-icon {
  font-size: 10px;
  opacity: 0.6;
}

.site-nav-op {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-nav-op-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-badge {
  flex-shrink: 0;
  display: inline-block;
  min-width: 42px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-align: center;
}

.method-get { background: color-mix(in oklch, oklch(65% 0.15 145) 18%, transparent); color: oklch(45% 0.13 145); }
.method-post { background: color-mix(in oklch, oklch(60% 0.16 255) 18%, transparent); color: oklch(55% 0.14 255); }
.method-put { background: color-mix(in oklch, oklch(70% 0.15 85) 18%, transparent); color: oklch(48% 0.13 85); }
.method-patch { background: color-mix(in oklch, oklch(70% 0.14 60) 18%, transparent); color: oklch(50% 0.12 60); }
.method-delete { background: color-mix(in oklch, oklch(55% 0.18 25) 18%, transparent); color: oklch(50% 0.16 25); }
.method-other { background: var(--fg-soft); color: var(--muted); }
</style>
