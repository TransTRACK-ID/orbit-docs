<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const { status } = useAuth();
const isAuthenticated = computed(() => status.value === "authenticated");

const route = useRoute();
const isNotFound = computed(() => props.error?.statusCode === 404);
const title = computed(() => (isNotFound.value ? "Page not found" : "Something went wrong"));
const message = computed(() =>
  isNotFound.value
    ? "This page doesn't exist or was moved. Check the URL, or head back to a page you know."
    : "An unexpected error stopped this page from loading. Try again in a moment."
);
const homePath = computed(() => (isAuthenticated.value ? "/apps" : "/"));
const homeLabel = computed(() => (isAuthenticated.value ? "Go to Apps" : "Go to Help Center"));

useHead({ title: () => `${title.value} · Orbit Docs` });

function retry() {
  clearError({ redirect: route.fullPath });
}
</script>

<template>
  <main class="error-page">
    <div class="error-body">
      <p class="error-code">Error {{ error?.statusCode || 500 }}</p>
      <h1 class="error-title">{{ title }}</h1>
      <p class="error-message">{{ message }}</p>
      <p v-if="isNotFound" class="error-path">{{ route.fullPath }}</p>
      <div class="error-actions">
        <button
          v-if="!isNotFound"
          type="button"
          class="btn btn-primary"
          @click="retry"
        >
          Try again
        </button>
        <button
          type="button"
          :class="['btn', isNotFound ? 'btn-primary' : 'btn-secondary']"
          @click="clearError({ redirect: homePath })"
        >
          {{ homeLabel }}
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background: var(--bg);
  color: var(--fg);
}
.error-body {
  max-width: 440px;
}
.error-code {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 12px;
}
.error-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}
.error-message {
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
  margin: 0;
}
.error-path {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg);
  background: var(--fg-soft);
  border-radius: var(--radius);
  padding: 4px 8px;
  margin: 16px 0 0;
  display: inline-block;
  word-break: break-all;
}
.error-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}
</style>
