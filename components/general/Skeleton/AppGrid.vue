<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 8,
  },
);
</script>

<template>
  <div class="app-grid" aria-busy="true" aria-label="Memuat aplikasi">
    <article
      v-for="n in count"
      :key="n"
      class="app-card skeleton-card"
      aria-hidden="true"
    >
      <div class="skeleton-card-top">
        <span class="sk-shimmer sk-avatar" />
        <div class="skeleton-card-titles">
          <span class="sk-shimmer sk-title" />
          <span class="sk-shimmer sk-meta" />
        </div>
        <span class="sk-shimmer sk-pill" />
      </div>

      <span class="sk-shimmer sk-version-strip" />

      <div class="skeleton-card-foot">
        <span class="sk-shimmer sk-link" />
        <span class="sk-shimmer sk-link" />
        <span class="sk-shimmer sk-menu" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.app-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 36px;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.skeleton-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sk-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.skeleton-card-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sk-title {
  height: 14px;
  width: 58%;
}

.sk-meta {
  height: 11px;
  width: 42%;
}

.sk-pill {
  width: 56px;
  height: 22px;
  border-radius: 999px;
  flex-shrink: 0;
}

.sk-version-strip {
  height: 32px;
  width: 100%;
  border-radius: var(--radius);
}

.skeleton-card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.sk-link {
  height: 28px;
  width: 72px;
  border-radius: var(--radius);
}

.sk-menu {
  height: 28px;
  width: 28px;
  border-radius: var(--radius);
  margin-left: auto;
}

@media (max-width: 1200px) {
  .app-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .app-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}
</style>
