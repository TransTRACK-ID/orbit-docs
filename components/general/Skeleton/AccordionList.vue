<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
    expandedFirst?: boolean;
    rowsPerAccordion?: number;
  }>(),
  {
    count: 3,
    expandedFirst: true,
    rowsPerAccordion: 4,
  },
);
</script>

<template>
  <div class="accordion-list" aria-busy="true" aria-label="Memuat data">
    <section
      v-for="n in count"
      :key="n"
      class="system-accordion skeleton-accordion"
    >
      <div class="skeleton-accordion-header">
        <span class="sk-shimmer sk-chevron" aria-hidden="true" />
        <span class="sk-shimmer sk-group-title" aria-hidden="true" />
        <span class="sk-shimmer sk-group-count" aria-hidden="true" />
      </div>

      <div
        v-if="expandedFirst && n === 1"
        class="skeleton-accordion-body"
        aria-hidden="true"
      >
        <div class="skeleton-table-head">
          <span class="sk-shimmer" />
          <span class="sk-shimmer" />
          <span class="sk-shimmer" />
          <span class="sk-shimmer" />
        </div>
        <div
          v-for="row in rowsPerAccordion"
          :key="row"
          class="skeleton-table-row"
        >
          <span class="sk-shimmer sk-cell-title" />
          <span class="sk-shimmer sk-cell-badge" />
          <span class="sk-shimmer sk-cell-date" />
          <span class="sk-shimmer sk-cell-author" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.accordion-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}

.skeleton-accordion-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.sk-chevron {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
}

.sk-group-title {
  flex: 1;
  min-width: 0;
  height: 12px;
  max-width: 180px;
}

.sk-group-count {
  width: 72px;
  height: 12px;
  flex-shrink: 0;
}

.skeleton-accordion-body {
  border-top: 1px solid var(--border);
  padding: 0 16px 12px;
}

.skeleton-table-head {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 88px 96px 1fr;
  gap: 12px;
  padding: 12px 0 8px;
}

.skeleton-table-head .sk-shimmer {
  height: 10px;
  border-radius: 3px;
  opacity: 0.7;
}

.skeleton-table-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 88px 96px 1fr;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
}

.sk-cell-title {
  height: 14px;
  width: 72%;
}

.sk-cell-badge {
  height: 20px;
  width: 64px;
  border-radius: 999px;
}

.sk-cell-date {
  height: 12px;
  width: 80%;
}

.sk-cell-author {
  height: 12px;
  width: 60%;
}
</style>
