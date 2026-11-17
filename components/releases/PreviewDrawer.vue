<script setup lang="ts">
import { extractHeadings, renderMarkdown } from "~/composables/useMarkdown";
import { formatDisplayVersion, formatReleaseHeading } from "~/utils/functions";
import type { ReleaseItem } from "~/composables/useReleases";

const props = defineProps<{
  release: ReleaseItem | null;
  /** Edit target (changelog editor or release editor); null hides the link. */
  editLink?: string | null;
  editLabel?: string;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

const drawerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  nextTick(() => drawerRef.value?.focus());
});

const headline = computed(() =>
  props.release
    ? formatReleaseHeading(props.release.appName, props.release.version, props.release.heroTitle)
    : "",
);

const outline = computed(() =>
  props.release?.type === "article"
    ? extractHeadings(props.release.summary || "").filter((h) => h.level <= 3)
    : [],
);

const categoryConfig: Record<string, { label: string; tagClass: string }> = {
  fixed: { label: "Fixed", tagClass: "rl-tag-fixed" },
  added: { label: "Added", tagClass: "rl-tag-added" },
  changed: { label: "Changed", tagClass: "rl-tag-changed" },
  deprecated: { label: "Deprecated", tagClass: "rl-tag-deprecated" },
  security: { label: "Security", tagClass: "rl-tag-security" },
};

const categoryGroups = computed(() => {
  const cats = props.release?.categories;
  if (props.release?.type !== "normal" || !cats) return [];
  return (Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>)
    .map((key) => ({ key, items: (cats as Record<string, string[] | undefined>)[key] || [] }))
    .filter((g) => g.items.length > 0);
});

const bodyHtml = computed(() =>
  props.release?.summary ? renderMarkdown(props.release.summary) : "",
);
</script>

<template>
  <Teleport to="body">
    <div class="rp-scrim" @click.self="emit('close')">
      <aside
        ref="drawerRef"
        class="rp-drawer"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="headline ? `${headline} preview` : 'Release preview'"
      >
        <div v-if="!release" class="rp-loading" aria-busy="true" aria-label="Loading release">
          <span class="sk-shimmer" style="width: 320px; height: 22px" />
          <span class="sk-shimmer" style="width: 240px; height: 14px" />
        </div>

        <template v-else>
          <header class="rp-head">
            <div class="rp-head__row">
              <h2 class="rp-title">{{ headline }}</h2>
              <span class="pill" :class="release.published ? 'pill-green' : 'pill-blue'">
                {{ release.published ? "PUBLISHED" : "DRAFT" }}
              </span>
              <span class="pill pill-muted">{{ release.type === "article" ? "ARTICLE" : "CHANGELOG" }}</span>
              <div class="rp-actions">
                <NuxtLink v-if="editLink" :to="editLink" class="rp-link">{{ editLabel || "Edit" }}</NuxtLink>
                <NuxtLink :to="`/releases/${release.id}`" class="rp-link">Open page</NuxtLink>
                <button type="button" class="rp-close" aria-label="Close" @click="emit('close')">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="rp-chips">
              <span v-if="release.version" class="meta-chip">Version {{ formatDisplayVersion(release.version) }}</span>
              <span class="meta-chip">Product {{ release.appName }}</span>
            </div>
          </header>

          <section v-if="outline.length" class="rp-contents" aria-label="Contents">
            <div class="rp-eyebrow">Contents</div>
            <ul class="rp-outline" role="list">
              <li
                v-for="(heading, idx) in outline"
                :key="`${release.id}-h-${idx}`"
                :class="`rp-outline__item level-${heading.level}`"
              >
                {{ heading.text }}
              </li>
            </ul>
          </section>

          <div class="rp-body">
            <template v-if="categoryGroups.length">
              <div v-for="group in categoryGroups" :key="group.key" class="rl-cat-group">
                <h3 class="rl-cat-heading">
                  <span class="rl-cat-badge" :class="categoryConfig[group.key]?.tagClass">
                    {{ categoryConfig[group.key]?.label }}
                  </span>
                </h3>
                <ul class="rl-cat-list">
                  <li v-for="item in group.items" :key="item">{{ item }}</li>
                </ul>
              </div>
            </template>
            <MermaidHtml v-else-if="bodyHtml" class="rp-markdown" :html="bodyHtml" />
            <p v-else class="rp-empty">No content yet.</p>
          </div>
        </template>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.rp-scrim {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  justify-content: flex-end;
  background: color-mix(in oklch, var(--fg) 25%, transparent);
  animation: rpScrimIn 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.rp-drawer {
  display: flex;
  flex-direction: column;
  width: min(951px, 100vw);
  height: 100%;
  overflow-y: auto;
  background: var(--surface);
  border-radius: 12px 0 0 12px;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  animation: rpDrawerIn 0.25s cubic-bezier(0.25, 1, 0.5, 1);
}

.rp-drawer:focus {
  outline: none;
}

@keyframes rpScrimIn {
  from {
    opacity: 0;
  }
}

@keyframes rpDrawerIn {
  from {
    transform: translateX(32px);
    opacity: 0;
  }
}

.rp-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 32px 28px;
}

.rp-head {
  padding: 28px 28px 20px;
}

.rp-head__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rp-title {
  margin: 0;
  min-width: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--fg);
}

.rp-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.rp-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-strong);
  text-decoration: none;
  white-space: nowrap;
}

.rp-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.rp-link:focus-visible,
.rp-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.rp-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.rp-close:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.rp-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}

.rp-contents {
  margin: 0 28px 20px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--fg) 2%, var(--surface));
}

.rp-eyebrow {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.rp-outline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rp-outline__item {
  font-size: 14px;
  line-height: 1.4;
  color: var(--fg);
}

.rp-outline__item.level-2 {
  padding-left: 12px;
  color: var(--muted);
}

.rp-outline__item.level-3 {
  padding-left: 24px;
  font-size: 13px;
  color: var(--muted);
}

.rp-body {
  padding: 0 28px 40px;
}

.rp-empty {
  margin: 0;
  padding: 24px 0;
  font-size: 14px;
  color: var(--muted);
}

.rp-markdown :deep(.preview-body) {
  max-width: none;
  font-size: 14px;
  line-height: 1.65;
  color: var(--fg);
}

.rp-markdown :deep(h2),
.rp-markdown :deep(h3) {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-size: 15px;
  font-weight: 600;
}

.rp-markdown :deep(p) {
  margin: 0 0 0.75em;
  color: var(--muted);
}

.rp-markdown :deep(ul) {
  margin: 0 0 1em;
  padding-left: 1.25rem;
}

.rl-cat-group {
  margin-bottom: 16px;
}

.rl-cat-heading {
  margin: 0 0 8px;
}

.rl-cat-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rl-cat-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
}

.rl-tag-added {
  background: color-mix(in oklch, var(--success) 12%, transparent);
  color: var(--success-text);
}

.rl-tag-fixed {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
}

.rl-tag-changed {
  background: color-mix(in oklch, var(--warning) 12%, transparent);
  color: var(--warning-text);
}

.rl-tag-deprecated {
  background: color-mix(in oklch, oklch(55% 0.2 295) 12%, transparent);
  color: oklch(50% 0.16 295);
}

.rl-tag-security {
  background: color-mix(in oklch, var(--error) 12%, transparent);
  color: var(--error-text);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.pill-blue {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
}

.pill-green {
  background: color-mix(in oklch, var(--success) 12%, transparent);
  color: var(--success-text);
}

.pill-muted {
  background: var(--fg-soft);
  color: var(--muted);
}

@media (max-width: 768px) {
  .rp-drawer {
    border-radius: 0;
  }

  .rp-head,
  .rp-body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .rp-contents {
    margin-left: 16px;
    margin-right: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rp-scrim,
  .rp-drawer {
    animation: none;
  }
}
</style>
