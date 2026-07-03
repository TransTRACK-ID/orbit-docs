<script setup lang="ts">
import DocResultViewer from "~/components/docs/DocResultViewer.vue";
import type { DocGenerationResult } from "~/composables/useDocGenerator";

definePageMeta({
  layout: "public",
  auth: false,
  layoutTransition: false,
  pageTransition: false,
});

const route = useRoute();
const token = computed(() => route.params.token as string);
const { status: authStatus, getSession } = useAuth();

const result = ref<DocGenerationResult | null>(null);
const sessionAppName = ref<string | null>(null);
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const sessionResolved = ref(false);

const isSignedIn = computed(() => authStatus.value === "authenticated");
const canCollaborate = computed(
  () =>
    sessionResolved.value &&
    isSignedIn.value &&
    Boolean(result.value?.jobId && result.value?.appId)
);

const loginUrl = computed(() => {
  const redirect = encodeURIComponent(route.fullPath);
  return `/login?redirect=${redirect}`;
});

async function loadSharedSession() {
  if (!token.value) return;
  isLoading.value = true;
  loadError.value = null;
  try {
    const data = await $fetch<{ data: DocGenerationResult & { sharedAt?: string | null } }>(
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
}

onMounted(async () => {
  await getSession().catch(() => {});
  sessionResolved.value = true;
  await loadSharedSession();
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
      <p v-if="!sessionResolved" class="share-page-note">Loading session…</p>
      <p v-else-if="canCollaborate" class="share-page-note share-page-note--team">
        Signed in. Use the <strong>Review</strong> button above the document to comment and set status per tab.
      </p>
      <p v-else class="share-page-note">
        Read-only view.
        <NuxtLink :to="loginUrl" class="share-page-login">Sign in to Orbit</NuxtLink>
        to comment or edit.
      </p>
    </header>

    <div v-if="isLoading" class="share-page-state">
      <p>Loading documents…</p>
    </div>

    <div v-else-if="loadError" class="share-page-state share-page-state--error">
      <p class="share-page-state-title">Session not found</p>
      <p>{{ loadError }}</p>
    </div>

    <div v-else-if="result && !sessionResolved" class="share-page-state">
      <p>Preparing viewer…</p>
    </div>

    <DocResultViewer
      v-else-if="result && sessionResolved"
      :srs="result.srs"
      :fsd="result.fsd"
      :git-snapshot="result.gitSnapshot"
      :sdd="result.sdd"
      :repo-results="result.repoResults"
      :app-id="result.appId"
      :job-id="result.jobId"
      :readonly="!canCollaborate"
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

.share-page-note--team {
  color: var(--fg);
}

.share-page-login {
  color: var(--accent);
  font-weight: 500;
  text-decoration: none;
}

.share-page-login:hover {
  text-decoration: underline;
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

<style>
.public-shell .public-main:has(.share-page) {
  max-width: min(1280px, 100%);
  padding: 24px 28px 40px;
}
</style>
