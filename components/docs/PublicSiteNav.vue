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

const { prefetchPage, prefetchSite } = usePublicSite();

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

function handleNavPrefetch(event: MouseEvent) {
  const link = (event.target as HTMLElement | null)?.closest("a[href]") as
    | HTMLAnchorElement
    | null;
  if (!link || link.target === "_blank") return;

  const path = link.getAttribute("href");
  if (!path) return;

  const pageMatch = path.match(new RegExp(`^/s/${escapeRegExp(props.siteSlug)}/([^/]+)$`));
  if (pageMatch?.[1]) {
    prefetchPage(props.siteSlug, pageMatch[1]);
    return;
  }

  const apiMatch = path.match(
    new RegExp(`^/s/${escapeRegExp(props.siteSlug)}/api/([^/]+)$`),
  );
  if (apiMatch?.[1]) prefetchSite(props.siteSlug);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
</script>

<template>
  <nav class="site-nav" aria-label="Site navigation" @mouseover="handleNavPrefetch">
    <p v-if="!hasAnyNavItems" class="site-nav-empty">No pages published yet.</p>

    <ul v-else class="doc-nav doc-nav--site doc-nav--sidebar" role="list">
      <template v-for="group in navConfig?.groups || []" :key="group.id">
        <li v-if="groupHasPages(group)" class="site-nav-section">
          <div class="site-nav-section-title">{{ group.label }}</div>
          <ul class="site-nav-links" role="list">
            <li v-for="slug in publishedSlugs(group.pages)" :key="`${group.id}-${slug}`">
              <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
                {{ pageTitle(slug) }}
              </NuxtLink>
            </li>
            <template v-for="sub in group.groups || []" :key="sub.id">
              <li v-if="groupHasPages(sub)" class="site-nav-nested">
                <div class="site-nav-nested-title">{{ sub.label }}</div>
                <ul class="site-nav-links" role="list">
                  <li v-for="slug in publishedSlugs(sub.pages)" :key="`${sub.id}-${slug}`">
                    <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
                      {{ pageTitle(slug) }}
                    </NuxtLink>
                  </li>
                </ul>
              </li>
            </template>
          </ul>
        </li>
      </template>

      <li v-if="showPagesSection" class="site-nav-section">
        <div class="site-nav-section-title">Pages</div>
        <ul class="site-nav-links" role="list">
          <li v-for="slug in pagesSectionSlugs" :key="`page-${slug}`">
            <NuxtLink :to="href(slug)" :class="{ active: isActive(slug) }">
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
        class="site-nav-section site-nav-section--collapsible"
      >
        <button
          type="button"
          class="site-nav-section-trigger"
          :aria-expanded="apiExpanded"
          aria-controls="site-nav-api-panel"
          @click="toggleApiSection"
        >
          <span class="site-nav-section-title site-nav-section-title--inline">API reference</span>
          <span class="site-nav-meta">{{ apiOperationCount }}</span>
          <svg
            class="site-nav-chevron"
            :class="{ 'is-expanded': apiExpanded }"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 4.5 10 8 6 11.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
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
              <span class="site-nav-meta site-nav-meta--sub">{{ group.items.length }}</span>
              <svg
                class="site-nav-chevron site-nav-chevron--sm"
                :class="{ 'is-expanded': isTagExpanded(group.tag) }"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 4.5 10 8 6 11.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            <ul
              v-show="isTagExpanded(group.tag)"
              :id="tagPanelId(group.tag)"
              class="site-nav-links site-nav-links--api"
              role="list"
            >
              <li v-for="op in group.items" :key="`oa-${op.slug}`">
                <NuxtLink
                  :to="operationHref(op.slug)"
                  class="site-nav-op"
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
  overscroll-behavior: contain;
}

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

.site-nav-section-title--inline {
  padding: 0;
  flex: 1;
  text-align: left;
}

.site-nav-section-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 8px);
  margin: 0 4px;
  padding: 0 8px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  border-radius: 8px;
}

.site-nav-section-trigger:hover {
  background: color-mix(in oklch, var(--fg) 4%, transparent);
}

.site-nav-section-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
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

.site-nav-links--api {
  padding-left: 4px;
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

.site-nav-meta {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--fg) 6%, transparent);
}

.site-nav-meta--sub {
  margin-left: auto;
  margin-right: 4px;
}

.site-nav-chevron {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--muted);
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.site-nav-chevron--sm {
  width: 12px;
  height: 12px;
}

.site-nav-chevron.is-expanded {
  transform: rotate(90deg);
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
  padding-bottom: 4px;
}

.site-nav-api-tag + .site-nav-api-tag {
  margin-top: 2px;
}

.site-nav-tag-trigger {
  display: flex;
  align-items: center;
  width: calc(100% - 8px);
  margin: 0 4px;
  padding: 5px 8px 5px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: var(--muted);
  text-align: left;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
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

.site-nav-external {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 6px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  border-radius: 8px;
}

.site-nav-external:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 6%, transparent);
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
  min-width: 40px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-align: center;
  letter-spacing: 0.02em;
}

.method-get { background: color-mix(in oklch, oklch(65% 0.15 145) 18%, transparent); color: oklch(45% 0.13 145); }
.method-post { background: color-mix(in oklch, oklch(60% 0.16 255) 18%, transparent); color: oklch(55% 0.14 255); }
.method-put { background: color-mix(in oklch, oklch(70% 0.15 85) 18%, transparent); color: oklch(48% 0.13 85); }
.method-patch { background: color-mix(in oklch, oklch(70% 0.14 60) 18%, transparent); color: oklch(50% 0.12 60); }
.method-delete { background: color-mix(in oklch, oklch(55% 0.18 25) 18%, transparent); color: oklch(50% 0.16 25); }
.method-other { background: var(--fg-soft); color: var(--muted); }
</style>
