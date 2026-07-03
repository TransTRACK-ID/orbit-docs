<script setup lang="ts">
withDefaults(
  defineProps<{
    /** When true, wraps the table in a horizontal scroll container. */
    scrollable?: boolean;
  }>(),
  { scrollable: true }
);
</script>

<template>
  <div class="table-panel">
    <div v-if="scrollable" class="table-scroll">
      <table class="ds-table">
        <slot />
      </table>
    </div>
    <table v-else class="ds-table">
      <slot />
    </table>
  </div>
</template>
