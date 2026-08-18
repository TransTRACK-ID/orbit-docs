<script setup lang="ts">
import type { PublicProduct } from "~/composables/usePublicSupport";

defineProps<{
  products: PublicProduct[];
  emptyMessage?: string;
}>();
</script>

<template>
  <ul v-if="products.length" class="support-product-grid">
    <li v-for="product in products" :key="product.id">
      <NuxtLink :to="`/support/${product.slug}`" class="support-product-tile">
        <SupportProductLogo :name="product.name" :logo-url="product.logoUrl" size="lg" />
        <span class="support-product-name">{{ product.name }}</span>
        <span v-if="product.isWikiSite" class="support-product-badge">Team wiki</span>
      </NuxtLink>
    </li>
  </ul>
  <p v-else class="support-empty">
    {{ emptyMessage || "No products match your search." }}
  </p>
</template>
