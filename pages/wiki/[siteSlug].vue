<script setup lang="ts">
import PublicSiteNav from "~/components/docs/PublicSiteNav.vue";
import WikiInternalHeader from "~/components/docs/WikiInternalHeader.vue";
import type { WikiSite } from "~/composables/useInternalWiki";
import { provideWikiPageMeta } from "~/composables/useWikiPageMeta";

provideWikiPageMeta();

definePageMeta({
  layout: false,
  auth: true,
  pageTransition: false,
});

const route = useRoute();
const { fetchSite, getCachedSite } = useInternalWiki();

const siteSlug = computed(() => route.params.siteSlug as string);
const site = ref<WikiSite | null>(null);
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

const pathPrefix = computed(() => `/wiki/${siteSlug.value}`);

useHead(() => ({
  title: site.value?.name ? `${site.value.name} (Wiki)` : "Wiki",
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
  <div class="doc-reader-page wiki-reader-page">
    <div v-if="isLoading && !site" class="ps-loading">Loading…</div>

    <div v-else-if="error && !site" class="ps-error">
      <h1>{{ error }}</h1>
      <p>The wiki site could not be loaded.</p>
      <NuxtLink to="/sites" class="wiki-fallback-link">Back to doc sites</NuxtLink>
    </div>

    <template v-else-if="site">
      <WikiInternalHeader
        :site-name="site.name"
        :site-slug="site.slug"
        :site-id="site.id"
        :site-status="site.status"
      />

      <div class="wiki-reader-body doc-shell">
        <aside class="doc-sidebar">
          <div class="doc-sidebar-header">
            <NuxtLink :to="pathPrefix" class="doc-sidebar-title">{{ site.name }}</NuxtLink>
            <p v-if="site.app" class="doc-sidebar-meta">{{ site.app.name }}</p>
            <p class="doc-sidebar-meta wiki-internal-label">Internal wiki</p>
          </div>
          <div class="doc-sidebar-nav">
            <PublicSiteNav
              :nav-config="site.navConfig"
              :site-slug="siteSlug"
              :pages="site.pages"
              :openapi-operations="openapiOps"
              :active-page-slug="activePageSlug"
              :active-operation-slug="activeOperationSlug"
              :path-prefix="pathPrefix"
              show-status
              wiki-mode
            />
          </div>
        </aside>

        <NuxtPage />
      </div>
    </template>
  </div>
</template>

<style scoped>
.wiki-reader-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
}

.wiki-reader-body {
  flex: 1;
  min-height: 0;
  height: auto;
}

.wiki-internal-label {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.wiki-fallback-link {
  display: inline-block;
  margin-top: 12px;
  color: var(--accent);
}
</style>
