<script setup lang="ts">
import PublicSiteNav from "~/components/docs/PublicSiteNav.vue";
import type { PublicSite } from "~/composables/usePublicSite";

definePageMeta({
  layout: false,
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const router = useRouter();
const { fetchSite } = usePublicSite();

const siteSlug = computed(() => route.params.siteSlug as string);
const site = ref<PublicSite | null>(null);
const isLoading = ref(true);
const error = ref("");

const openapiOps = computed(() => {
  const fromNav = site.value?.navConfig?.openapi;
  if (fromNav?.length) return fromNav;
  return site.value?.openapiNormalized?.operations || [];
});

const apiGroups = computed(() => {
  const ops = openapiOps.value;
  const groups = new Map<string, typeof ops>();
  for (const op of ops) {
    const tag = op.tag || "API";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag)!.push(op);
  }
  return [...groups.entries()].map(([tag, items]) => ({ tag, items }));
});

const docPages = computed(() => site.value?.pages || []);

useHead(() => ({
  title: site.value?.name || "Docs",
}));
useSeoMeta(() => ({
  description: site.value?.description || undefined,
}));

onMounted(load);
watch(siteSlug, load);

async function load() {
  isLoading.value = true;
  error.value = "";
  site.value = null;
  try {
    const data = await fetchSite(siteSlug.value);
    const firstSlug = firstPageSlug(data.navConfig, data.pages);
    if (firstSlug) {
      router.replace(`/s/${siteSlug.value}/${firstSlug}`);
      return;
    }
    site.value = data;
  } catch (e: any) {
    error.value = e?.statusMessage || "Site not found";
  } finally {
    isLoading.value = false;
  }
}

function firstPageSlug(
  navConfig: PublicSite["navConfig"],
  pages: Array<{ slug: string | null }>,
): string | null {
  const publishedSlugs = new Set(pages.map((p) => p.slug).filter(Boolean));
  const visitGroup = (g: { pages?: string[]; groups?: any[] }): string | null => {
    if (g.pages) {
      for (const s of g.pages) {
        if (publishedSlugs.has(s)) return s;
      }
    }
    if (g.groups) {
      for (const sub of g.groups) {
        const found = visitGroup(sub);
        if (found) return found;
      }
    }
    return null;
  };
  if (navConfig?.pages) {
    for (const s of navConfig.pages) {
      if (publishedSlugs.has(s)) return s;
    }
  }
  if (navConfig?.groups) {
    for (const g of navConfig.groups) {
      const found = visitGroup(g);
      if (found) return found;
    }
  }
  return null;
}
</script>

<template>
  <div class="doc-reader-page">
    <div v-if="isLoading" class="ps-loading">Loading…</div>

    <div v-else-if="error" class="ps-error">
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
            active-page-slug=""
          />
        </div>
      </aside>

      <main class="doc-content">
        <div class="doc-content-row">
          <article class="doc-body">
            <h1 class="doc-body-title">{{ site.name }}</h1>
            <p v-if="site.description" class="ps-landing-desc">{{ site.description }}</p>
            <p v-else class="ps-landing-desc ps-landing-desc--muted">Welcome to the documentation.</p>

            <section v-if="docPages.length" class="ps-section">
              <h2 class="ps-section-title">Pages</h2>
              <ul class="ps-link-list">
                <li v-for="p in docPages" :key="p.id">
                  <NuxtLink v-if="p.slug" :to="`/s/${siteSlug}/${p.slug}`" class="ps-link">
                    {{ p.title }}
                  </NuxtLink>
                  <span v-else class="ps-muted">{{ p.title }} (no slug)</span>
                </li>
              </ul>
            </section>

            <section v-if="apiGroups.length" class="ps-section">
              <h2 class="ps-section-title">API reference</h2>
              <p class="ps-muted" style="margin-bottom: 16px">Browse endpoints in the sidebar, or jump to one below.</p>
              <div v-for="group in apiGroups" :key="group.tag" style="margin-top: 20px">
                <h3 class="ps-section-title">{{ group.tag }}</h3>
                <ul class="ps-link-list">
                  <li v-for="op in group.items" :key="op.slug">
                    <NuxtLink :to="`/s/${siteSlug}/api/${op.slug}`" class="ps-link">
                      <span class="method-badge" :class="`method-${op.method.toLowerCase()}`">{{ op.method }}</span>
                      {{ op.label }}
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </section>

            <p v-if="!docPages.length && !apiGroups.length" class="ps-muted">
              This site has no published pages or API operations yet.
            </p>
          </article>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.method-badge {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px 6px;
  border-radius: 4px;
}
.method-get { background: color-mix(in oklch, oklch(65% 0.15 145) 18%, transparent); color: oklch(45% 0.13 145); }
.method-post { background: color-mix(in oklch, oklch(60% 0.16 255) 18%, transparent); color: oklch(55% 0.14 255); }
.method-put { background: color-mix(in oklch, oklch(70% 0.15 85) 18%, transparent); color: oklch(48% 0.13 85); }
.method-patch { background: color-mix(in oklch, oklch(70% 0.14 60) 18%, transparent); color: oklch(50% 0.12 60); }
.method-delete { background: color-mix(in oklch, oklch(55% 0.18 25) 18%, transparent); color: oklch(50% 0.16 25); }
</style>
