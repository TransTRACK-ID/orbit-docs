<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 4,
  },
);
</script>

<template>
  <div class="release-timeline" aria-busy="true" aria-label="Memuat rilis">
    <article
      v-for="n in count"
      :key="n"
      class="release-entry skeleton-release"
      aria-hidden="true"
    >
      <div class="release-rail">
        <span class="sk-shimmer sk-date" />
        <span class="sk-shimmer sk-label" />
      </div>

      <div class="release-main">
        <div class="skeleton-release-head">
          <span class="sk-shimmer sk-title" />
          <div class="skeleton-badges">
            <span class="sk-shimmer sk-pill" />
            <span class="sk-shimmer sk-pill" />
          </div>
        </div>

        <div class="skeleton-chips">
          <span class="sk-shimmer sk-chip" />
          <span class="sk-shimmer sk-chip" />
        </div>

        <span class="sk-shimmer sk-preview" />
        <span class="sk-shimmer sk-preview sk-preview--short" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.skeleton-release {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 24px;
  padding: 28px 0;
  border-bottom: 1px solid var(--border);
}

.release-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.sk-date {
  width: 72px;
  height: 14px;
}

.sk-label {
  width: 40px;
  height: 10px;
}

.skeleton-release-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.sk-title {
  flex: 1;
  min-width: 0;
  height: 20px;
  max-width: 320px;
}

.skeleton-badges {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.sk-pill {
  width: 64px;
  height: 22px;
  border-radius: 999px;
}

.skeleton-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.sk-chip {
  width: 96px;
  height: 24px;
  border-radius: var(--radius);
}

.sk-preview {
  display: block;
  width: 100%;
  height: 12px;
  margin-bottom: 8px;
}

.sk-preview--short {
  width: 72%;
}
</style>
