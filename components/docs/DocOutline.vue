<script setup lang="ts">
import type { DocOutlineItem } from "~/composables/useDocOutline";

defineProps<{
  items: DocOutlineItem[];
  activeSlug: string;
}>();

const emit = defineEmits<{
  navigate: [slug: string];
}>();

function onClick(slug: string, event: MouseEvent) {
  event.preventDefault();
  emit("navigate", slug);
}
</script>

<template>
  <aside v-if="items.length" class="doc-outline-rail" aria-label="On this page">
    <div class="doc-outline-header">
      <svg class="doc-outline-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span>On this page</span>
    </div>
    <nav class="doc-outline-nav" aria-label="Page sections">
      <ul class="doc-nav doc-nav--outline" role="list">
        <li v-for="(item, idx) in items" :key="`${item.slug}-${idx}`">
          <a
            :class="[item.type, { active: activeSlug === item.slug }]"
            role="listitem"
            :href="`#${item.slug}`"
            @click="onClick(item.slug, $event)"
          >
            {{ item.text }}
          </a>
        </li>
      </ul>
    </nav>
  </aside>
</template>
