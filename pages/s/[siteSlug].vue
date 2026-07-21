<script setup lang="ts">
import PublicSiteNav from "~/components/docs/PublicSiteNav.vue";
import type { PublicSite } from "~/composables/usePublicSite";

definePageMeta({
  layout: false,
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const { fetchSite, getCachedSite } = usePublicSite();

const siteSlug = computed(() => route.params.siteSlug as string);
const site = ref<PublicSite | null>(null);
const isLoading = ref(true);
const error = ref("");

const activePageSlug = computed(() => {
  if (route.path.includes("/api/")) return "";
  const slug = route.params.pageSlug;
  return typeof slug === "string" ? slug : "";
});

const activeOperationSlug = computed(() => {
  const slug = route.params.operationSlug;
  return typeof slug === "string" ? slug : "";
});

const openapiOps = computed(() => {
  const fromNav = site.value?.navConfig?.openapi;
  if (fromNav?.length) return fromNav;
  return site.value?.openapiNormalized?.operations || [];
});

useHead(() => ({
  title: site.value?.name || "Docs",
}));

async function loadSite() {
  error.value = "";

  const cached = getCachedSite(siteSlug.value);
  if (cached) {
    site.value = cached;
    isLoading.value = false;
    return;
  }

  const keepShell = site.value?.slug === siteSlug.value;
  if (!keepShell) {
    isLoading.value = true;
    site.value = null;
  }

  try {
    site.value = await fetchSite(siteSlug.value);
    error.value = "";
  } catch (e: any) {
    error.value = e?.statusMessage || "Site not found";
    if (!keepShell) site.value = null;
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadSite);
watch(siteSlug, loadSite);
</script>

<template>
  <div class="doc-reader-page">
    <div v-if="isLoading && !site" class="ps-loading">Loading…</div>

    <div v-else-if="error && !site" class="ps-error">
      <h1>{{ error }}</h1>
      <p>The documentation site you are looking for could not be loaded.</p>
    </div>

    <div v-else-if="site" class="doc-shell">
      <aside class="doc-sidebar">
        <div class="doc-sidebar-header">
          <NuxtLink :to="`/s/${siteSlug}`" class="doc-sidebar-title">{{ site.name }}</NuxtLink>
          <p v-if="site.app" class="doc-sidebar-meta">{{ site.app.name }}</p>
        </div>
        <div class="doc-sidebar-nav">
          <PublicSiteNav
            :nav-config="site.navConfig"
            :site-slug="siteSlug"
            :pages="site.pages"
            :openapi-operations="openapiOps"
            :active-page-slug="activePageSlug"
            :active-operation-slug="activeOperationSlug"
          />
        </div>
      </aside>

      <NuxtPage />
    </div>
  </div>
</template>
