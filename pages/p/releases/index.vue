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

function formatMonthYear(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function detailLink(id: string): string {
  const params = new URLSearchParams();
  if (appFilter.value) params.set("app", appFilter.value);
  if (isEmbed.value) params.set("embed", "1");
  const q = params.toString();
  return q ? `/p/releases/${id}?${q}` : `/p/releases/${id}`;
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
  fixed: { label: "Fixed", tagClass: "rl-tag-fixed" },
  added: { label: "Added", tagClass: "rl-tag-added" },
  changed: { label: "Changed", tagClass: "rl-tag-changed" },
  deprecated: { label: "Deprecated", tagClass: "rl-tag-deprecated" },
  security: { label: "Security", tagClass: "rl-tag-security" },
};

// Group by month
const groupedByMonth = computed(() => {
  const groups: Record<string, ReleaseItem[]> = {};
  for (const r of filteredReleases.value) {
    const key = formatMonthYear(r.releaseDate);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.entries(groups).map(([month, items]) => ({
    month,
    items,
  }));
});

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
</script>

<template>
  <div class="rl">
    <!-- Header -->
    <header class="rl-head">
      <h1>{{ appFilter ? `${appFilter} Release Notes` : "What's New" }}</h1>
      <p class="rl-subtitle">
        {{ appFilter ? `Keep up with the latest releases for ${appFilter}.` : "Keep up with the latest releases, improvements, and fixes." }}
      </p>
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
      <div
        v-for="group in groupedByMonth"
        :key="group.month"
        class="rl-month-group"
      >
        <div class="rl-month-label">{{ group.month }}</div>
        <div class="rl-entries">
          <article
            v-for="r in group.items"
            :key="r.id"
            class="rl-entry"
          >
            <div class="rl-entry-header">
              <div class="rl-entry-date">
                <span class="rl-entry-day">{{ new Date(r.releaseDate || '').getDate() }}</span>
                <span class="rl-entry-weekday">{{ new Date(r.releaseDate || '').toLocaleDateString('en-US', { weekday: 'short' }) }}</span>
              </div>
              <div class="rl-entry-meta">
                <span class="rl-entry-version">{{ r.version }}</span>
                <span v-if="r.type === 'article'" class="rl-entry-type">Article</span>
              </div>
            </div>
            <h2 class="rl-entry-title">
              <NuxtLink v-if="r.type !== 'article'" :to="detailLink(r.id)">{{ r.heroTitle || `${r.appName} ${r.version}` }}</NuxtLink>
              <template v-else>{{ r.heroTitle || `${r.appName} ${r.version}` }}</template>
            </h2>
            <!-- Normal release: colored category badges -->
            <template v-if="r.type !== 'article' && r.categories">
              <div
                v-for="[key, items] in Object.entries(countCategories(r.categories)).filter(([, v]) => v.length > 0)"
                :key="key"
                class="rl-cat-group"
              >
                <span class="rl-cat-badge" :class="categoryConfig[key]?.tagClass || 'rl-tag-muted'">
                  {{ categoryConfig[key]?.label || key }}
                </span>
                <ul class="rl-cat-list">
                  <li v-for="item in items" :key="item">{{ item }}</li>
                </ul>
              </div>
            </template>
            <!-- Article or no categories: raw markdown -->
            <MermaidHtml
              v-else-if="r.summary"
              class="rl-entry-body"
              :html="renderMarkdown(r.summary)"
            />
            <div v-if="r.type === 'article' && !isEmbed" class="rl-entry-actions">
              <NuxtLink :to="detailLink(r.id)" class="rl-entry-link">Open release page →</NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rl {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

/* Header */
.rl-head {
  text-align: center;
  margin-bottom: 64px;
  padding-top: 24px;
}
.rl-head h1 {
  margin: 0 0 12px;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--fg);
}
.rl-subtitle {
  margin: 0 0 32px;
  font-size: 17px;
  line-height: 1.5;
  color: var(--muted);
}
.rl-search {
  max-width: 360px;
  margin: 0 auto;
}
.rl-search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font: inherit;
  font-size: 15px;
  color: var(--fg);
  transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rl-search-input::placeholder {
  color: var(--muted);
}
.rl-search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 12%, transparent);
}

/* Month Group */
.rl-month-group {
  display: flex;
  gap: 32px;
  margin-bottom: 64px;
}
.rl-month-group:last-child {
  margin-bottom: 0;
}

/* Month Label (sticky left) */
.rl-month-label {
  flex-shrink: 0;
  width: 100px;
  position: sticky;
  top: 24px;
  align-self: flex-start;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding-top: 24px;
}

/* Entries */
.rl-entries {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Entry */
.rl-entry {
  padding: 32px 0;
  border-bottom: 1px solid var(--border);
}
.rl-entry:first-child {
  padding-top: 0;
}
.rl-entry:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.rl-entry-title a {
  text-decoration: none;
  color: inherit;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.rl-entry-title a:hover {
  color: var(--accent);
}
.rl-entry-actions {
  margin-top: 16px;
}
.rl-entry-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.rl-entry-link:hover {
  color: var(--accent);
}

/* Entry Header */
.rl-entry-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

/* Date Block */
.rl-entry-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--fg-soft);
  flex-shrink: 0;
}
.rl-entry-day {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  color: var(--fg);
}
.rl-entry-weekday {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-top: 2px;
}

/* Meta */
.rl-entry-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rl-entry-version {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}
.rl-entry-type {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: oklch(55% 0.14 300);
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in oklch, oklch(55% 0.14 300) 8%, transparent);
}

/* Title */
.rl-entry-title {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg);
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Body */
.rl-entry-body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
}
.rl-entry-body :deep(p) {
  margin: 0 0 12px;
}
.rl-entry-body :deep(p:last-child) {
  margin-bottom: 0;
}
.rl-entry-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 24px 0;
  display: block;
}
.rl-entry-body :deep(video) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 24px 0;
  display: block;
}
.rl-entry-body :deep(iframe) {
  max-width: 100%;
  border-radius: 12px;
  margin: 24px 0;
  display: block;
}
.rl-entry-body :deep(blockquote) {
  margin: 24px 0;
  padding: 16px 20px;
  background: var(--fg-soft);
  border-radius: 8px;
  font-style: italic;
}
.rl-entry-body :deep(pre) {
  margin: 24px 0;
  padding: 16px;
  background: var(--bg);
  border-radius: 8px;
  overflow-x: auto;
}
.rl-entry-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.rl-entry-body :deep(h1),
.rl-entry-body :deep(h2),
.rl-entry-body :deep(h3) {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--fg);
}
.rl-entry-body :deep(ul) {
  margin: 0 0 12px;
  padding-left: 20px;
  list-style-type: disc;
}
.rl-entry-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 20px;
  list-style-type: decimal;
}
.rl-entry-body :deep(li) {
  margin-bottom: 4px;
}
.rl-entry-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 8px 12px;
  background: var(--fg-soft);
  border-radius: 6px;
  font-style: italic;
}
.rl-entry-body :deep(pre) {
  display: none;
}

/* Category badges (normal releases) */
.rl-cat-group {
  margin-bottom: 16px;
}
.rl-cat-group:last-child {
  margin-bottom: 0;
}
.rl-cat-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.rl-cat-list {
  padding-left: 0;
  list-style: none;
  margin: 0;
}
.rl-cat-list li {
  position: relative;
  padding-left: 18px;
  margin-bottom: 6px;
  line-height: 1.5;
  font-size: 14px;
  color: var(--muted);
}
.rl-cat-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.6em;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
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
.rl-tag-deprecated {
  background: color-mix(in oklch, oklch(60% 0.14 300) 8%, transparent);
  color: oklch(50% 0.12 300);
}
.rl-tag-security {
  background: color-mix(in oklch, oklch(60% 0.14 25) 8%, transparent);
  color: oklch(50% 0.12 25);
}
.rl-tag-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

/* Empty */
.rl-empty {
  padding: 80px 0;
  text-align: center;
  color: var(--muted);
}
.rl-empty p {
  margin: 0;
  font-size: 16px;
}

/* Responsive */
@media (max-width: 640px) {
  .rl-head h1 {
    font-size: 28px;
    letter-spacing: -0.02em;
  }
  .rl-subtitle {
    font-size: 15px;
  }
  .rl-month-group {
    flex-direction: column;
    gap: 16px;
  }
  .rl-month-label {
    position: static;
    width: auto;
    padding-top: 0;
    font-size: 12px;
  }
  .rl-entry {
    padding: 24px 0;
  }
  .rl-entry-title {
    font-size: 18px;
  }
  .rl-entry-header {
    gap: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rl-entry-link:hover .rl-entry-title {
    transition: none;
  }
}
</style>
