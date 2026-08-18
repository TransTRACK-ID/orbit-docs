<script setup lang="ts">
import type { PublicProduct, PublicWorkspace } from "~/composables/usePublicSupport";

definePageMeta({
  layout: "support",
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const { fetchWorkspace, fetchProduct } = usePublicSupport();

const workspace = ref<PublicWorkspace | null>(null);
const product = ref<PublicProduct | null>(null);
const search = ref("");
const isLoading = ref(true);
const loadError = ref("");

const productSlug = computed(() => route.params.slug as string);

const filteredPages = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!product.value || !q) return product.value?.pages || [];
  return product.value.pages.filter((page) => page.title.toLowerCase().includes(q));
});

const filteredDocSites = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!product.value || !q) return product.value?.docSites || [];
  return product.value.docSites.filter((site) => {
    const haystack = [site.name, site.description].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
});

const showReleases = computed(() => {
  if (!product.value?.releaseCount) return false;
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  return "release notes".includes(q) || product.value.name.toLowerCase().includes(q);
});

const releaseAppName = computed(() => product.value?.name || "");

useSeoMeta({
  title: () => (product.value ? `${product.value.name} Help` : "Product Help"),
  description: () =>
    product.value?.description ||
    "Product documentation, guides, and release notes.",
  ogTitle: () => (product.value ? `${product.value.name} Help` : "Product Help"),
  ogDescription: () =>
    product.value?.description ||
    "Product documentation, guides, and release notes.",
});

async function load() {
  isLoading.value = true;
  loadError.value = "";
  product.value = null;
  try {
    const [ws, item] = await Promise.all([
      fetchWorkspace(),
      fetchProduct(productSlug.value),
    ]);
    workspace.value = ws;
    product.value = item;
  } catch {
    loadError.value = "This product help center could not be found.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
watch(productSlug, load);
</script>

<template>
  <div>
    <NuxtLink to="/" class="support-back">
      <span aria-hidden="true">←</span>
      All products
    </NuxtLink>

    <div v-if="isLoading" class="support-loading">Loading…</div>

    <p v-else-if="loadError" class="support-empty">{{ loadError }}</p>

    <template v-else-if="product">
      <section class="support-product-hero">
        <div class="support-product-hero-top">
          <SupportProductLogo
            :name="product.name"
            :logo-url="product.logoUrl"
            size="md"
            class="support-product-hero-icon"
          />
          <div>
            <h1 class="support-product-hero-title">{{ product.name }}</h1>
            <p v-if="product.description" class="support-product-hero-desc">
              {{ product.description }}
            </p>
            <p v-else class="support-product-hero-desc">
              Documentation and release notes for {{ product.name }}.
            </p>
            <p v-if="product.isWikiSite" class="support-product-hero-note">
              Team wiki documentation. Sign in to read these pages.
            </p>
          </div>
        </div>

        <SupportSearch
          v-model="search"
          :placeholder="`Search ${product.name} help`"
        />
      </section>

      <section
        v-if="filteredDocSites.length"
        class="support-section"
        aria-labelledby="docs-heading"
      >
        <h2 id="docs-heading" class="support-section-title">Documentation</h2>
        <ul class="support-resource-list">
          <li v-for="site in filteredDocSites" :key="site.id">
            <NuxtLink :to="site.homePath" class="support-resource-link">
              <span class="support-resource-name">
                {{ site.name }}
                <span v-if="site.isWikiSite" class="support-resource-tag">Team wiki</span>
              </span>
              <span class="support-resource-meta">
                {{ site.pageCount }} page{{ site.pageCount === 1 ? "" : "s" }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section
        v-if="filteredPages.length"
        class="support-section"
        aria-labelledby="pages-heading"
      >
        <h2 id="pages-heading" class="support-section-title">Popular topics</h2>
        <ul class="support-resource-list">
          <li v-for="page in filteredPages" :key="page.id">
            <NuxtLink :to="page.path" class="support-resource-link">
              <span class="support-resource-name">{{ page.title }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section
        v-if="showReleases"
        class="support-section"
        aria-labelledby="releases-heading"
      >
        <h2 id="releases-heading" class="support-section-title">Release notes</h2>
        <ul class="support-resource-list">
          <li>
            <NuxtLink
              :to="`/p/releases?app=${encodeURIComponent(releaseAppName)}`"
              class="support-resource-link"
            >
              <span class="support-resource-name">{{ product.name }} releases</span>
              <span class="support-resource-meta">
                {{ product.releaseCount }} release{{ product.releaseCount === 1 ? "" : "s" }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <p
        v-if="!filteredDocSites.length && !filteredPages.length && !showReleases"
        class="support-empty"
      >
        {{ search.trim() ? "No help topics match your search." : "No published help content yet." }}
      </p>
    </template>
  </div>
</template>
