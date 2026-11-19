<script setup lang="ts">
import { appIconStyle, appInitials } from "~/utils/app-icon";
import { sanitizeBrandLogoUrl } from "~/utils/brand-logo-url";

const props = withDefaults(
  defineProps<{
    name: string;
    logoUrl?: string | null;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    logoUrl: null,
    size: "md",
  },
);

const logoFailed = ref(false);

watch(
  () => props.logoUrl,
  () => {
    logoFailed.value = false;
  },
);

const sizeClass = computed(() => `support-product-logo--${props.size}`);
const resolvedLogoUrl = computed(() => sanitizeBrandLogoUrl(props.logoUrl));
</script>

<template>
  <img
    v-if="resolvedLogoUrl && !logoFailed"
    :src="resolvedLogoUrl"
    :alt="`${name} logo`"
    class="support-product-logo"
    :class="sizeClass"
    @error="logoFailed = true"
  />
  <span
    v-else
    class="support-product-icon"
    :class="sizeClass"
    :style="appIconStyle(name)"
    aria-hidden="true"
  >
    {{ appInitials(name) }}
  </span>
</template>
