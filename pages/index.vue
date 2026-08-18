<script setup lang="ts">
import type { PublicProduct, PublicWorkspace } from "~/composables/usePublicSupport";

definePageMeta({
  layout: "support",
  auth: false,
  pageTransition: false,
});

const { fetchWorkspace, fetchProducts } = usePublicSupport();

const workspace = ref<PublicWorkspace | null>(null);
const products = ref<PublicProduct[]>([]);
const search = ref("");
const isLoading = ref(true);
const loadError = ref("");

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return products.value;
  return products.value.filter((product) => {
    const haystack = [
      product.name,
      product.description,
      ...((product.pages || []).map((page) => page.title)),
      ...product.docSites.map((site) => [site.name, site.description].join(" ")),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
});

useSeoMeta({
  title: () => (workspace.value ? `${workspace.value.name} Help` : "Help Center"),
  description: () =>
    workspace.value?.description ||
    "Browse product documentation, guides, and release notes.",
  ogTitle: () => (workspace.value ? `${workspace.value.name} Help` : "Help Center"),
  ogDescription: () =>
    workspace.value?.description ||
    "Browse product documentation, guides, and release notes.",
});

async function load() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const [ws, list] = await Promise.all([fetchWorkspace(), fetchProducts()]);
    workspace.value = ws;
    products.value = list;
  } catch {
    loadError.value = "Unable to load the help center right now.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <section class="support-hero">
      <h1 class="support-hero-title">
        {{ workspace?.name ? `${workspace.name} Help` : "Help Center" }}
      </h1>
      <p v-if="workspace?.description" class="support-hero-desc">
        {{ workspace.description }}
      </p>
      <p v-else class="support-hero-desc">
        Find documentation and release notes for every product.
      </p>
      <SupportSearch v-model="search" placeholder="Search all products" />
    </section>

    <div v-if="isLoading" class="support-loading">Loading products…</div>

    <p v-else-if="loadError" class="support-empty">{{ loadError }}</p>

    <section v-else class="support-section" aria-labelledby="products-heading">
      <h2 id="products-heading" class="support-section-title">Products</h2>
      <SupportProductLinkGrid
        :products="filteredProducts"
        :empty-message="
          search.trim()
            ? 'No products match your search.'
            : 'No doc sites with published pages yet. Publish docs on a site to list it here.'
        "
      />
    </section>
  </div>
</template>
