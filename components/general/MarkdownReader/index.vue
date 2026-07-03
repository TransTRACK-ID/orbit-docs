<script setup lang="ts">
import { renderMarkdown, extractHeadings } from "~/composables/useMarkdown";
import {
  buildMarkdownOutline,
  useMarkdownOutline,
} from "~/composables/useMarkdownOutline";

const props = withDefaults(
  defineProps<{
    content: string;
    /** full: outline + reader shell; compact: body only (list excerpts) */
    mode?: "full" | "compact";
    showOutline?: boolean;
    outlineTitle?: string;
    extraOutlineItems?: Array<{ id: string; label: string; level?: number }>;
  }>(),
  {
    mode: "full",
    showOutline: true,
    outlineTitle: "Outline",
    extraOutlineItems: () => [],
  }
);

const bodyRef = ref<HTMLElement | null>(null);
const headings = computed(() => extractHeadings(props.content));
const renderedHtml = computed(() => renderMarkdown(props.content));
const outlineItems = computed(() =>
  buildMarkdownOutline(headings.value, props.extraOutlineItems)
);

const showOutlinePane = computed(
  () => props.mode === "full" && props.showOutline
);

const { activeKey, scrollToItem, setupScrollSpy } = useMarkdownOutline(bodyRef);

watch(
  [outlineItems, renderedHtml],
  async () => {
    if (!showOutlinePane.value) return;
    await nextTick();
    setupScrollSpy(outlineItems.value);
  },
  { immediate: true }
);
</script>

<template>
  <div
    class="markdown-reader"
    :class="{
      'markdown-reader--compact': mode === 'compact',
      'markdown-reader--with-outline': showOutlinePane,
    }"
  >
    <aside v-if="showOutlinePane" class="outline-pane" aria-label="Document outline">
      <div class="outline-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity: 0.6;">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span class="outline-title">{{ outlineTitle }}</span>
      </div>
      <ul class="outline-tree" role="list">
        <li
          v-for="item in outlineItems"
          :key="item.key"
          :class="['outline-item', `level-${item.level}`, { active: activeKey === item.key }]"
          role="listitem"
          tabindex="0"
          @click="scrollToItem(item)"
          @keydown.enter="scrollToItem(item)"
          @keydown.space.prevent="scrollToItem(item)"
        >
          <span
            class="outline-marker"
            :class="{
              'level-h1': item.level === 1,
              'level-h2': item.level === 2,
              'level-h3': item.level === 3,
            }"
          >
            H{{ item.level }}
          </span>
          <span class="outline-text">{{ item.label }}</span>
        </li>
        <li v-if="outlineItems.length === 0" class="outline-empty">
          <div class="outline-empty-content">
            <span>No headings yet</span>
          </div>
        </li>
      </ul>
    </aside>

    <div ref="bodyRef" class="markdown-reader__body">
      <MermaidHtml class="markdown-body preview-body" :html="renderedHtml" />
    </div>
  </div>
</template>
