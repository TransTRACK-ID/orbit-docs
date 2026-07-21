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
    <ul class="doc-nav" role="list">
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
  </aside>
</template>
