<script setup lang="ts">
import DocResultViewer from "~/components/docs/DocResultViewer.vue";
import type { DocGenerationResult } from "~/composables/useDocGenerator";

definePageMeta({
  layout: "public",
  auth: false,
});

const route = useRoute();
const token = computed(() => route.params.token as string);

const result = ref<(DocGenerationResult & { appName?: string }) | null>(null);
const sessionAppName = ref<string | null>(null);
const isLoading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  if (!token.value) return;
  isLoading.value = true;
  loadError.value = null;
  try {
    const data = await $fetch<{ data: DocGenerationResult & { appName?: string; sharedAt?: string | null } }>(
      `/api/public/generate-docs/${token.value}`
    );
    result.value = data.data;
    sessionAppName.value = data.data.appName || null;
  } catch (e: any) {
    loadError.value = e?.data?.message || "This shared session is unavailable or has been disabled.";
    result.value = null;
  } finally {
    isLoading.value = false;
  }
});

useSeoMeta({
  title: "Shared generated documents",
  description: "Read-only view of an Orbit document generation session.",
  robots: "noindex, nofollow",
});
</script>

<template>
  <div class="share-page">
    <header class="share-page-header">
      <div class="share-page-brand">
        <NuxtLink to="/" class="share-page-logo">Orbit</NuxtLink>
        <span class="share-page-kicker">
          {{ sessionAppName ? `${sessionAppName} · ` : "" }}Shared generation session
        </span>
      </div>
      <p class="share-page-note">Read-only view. Sign in to Orbit to comment or edit.</p>
    </header>

    <div v-if="isLoading" class="share-page-state">
      <p>Loading documents…</p>
    </div>

    <div v-else-if="loadError" class="share-page-state share-page-state--error">
      <p class="share-page-state-title">Session not found</p>
      <p>{{ loadError }}</p>
    </div>

    <DocResultViewer
      v-else-if="result"
      :srs="result.srs"
      :fsd="result.fsd"
      :git-snapshot="result.gitSnapshot"
      :sdd="result.sdd"
      :repo-results="result.repoResults"
      readonly
    />
  </div>
</template>

<style scoped>
.share-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.share-page-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.share-page-brand {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.share-page-logo {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg);
  text-decoration: none;
}

.share-page-kicker {
  font-size: 13px;
  color: var(--muted);
}

.share-page-note {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.share-page-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.share-page-state-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
}

.share-page-state--error .share-page-state-title {
  color: oklch(50% 0.14 25);
}
</style>
