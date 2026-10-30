<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string | number }[];
  statsLabel?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
}>();

const search = defineModel<string>("search");
</script>

<template>
  <div class="page-header">
    <header class="page-masthead">
      <div class="page-masthead__copy">
        <h1>{{ title }}</h1>
        <p v-if="subtitle || $slots.subtitle" class="page-subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="page-masthead__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="nav" />

    <div v-if="search !== undefined || $slots.filters" class="filter-strip">
      <div v-if="search !== undefined" class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="search"
          class="search"
          :placeholder="searchPlaceholder"
          :aria-label="searchLabel || searchPlaceholder"
        />
      </div>
      <slot name="filters" />
    </div>

    <div v-if="stats?.length" class="stats-bar" :aria-label="statsLabel">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <span class="stat-num num">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>
