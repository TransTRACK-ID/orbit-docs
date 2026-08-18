<script setup lang="ts">
import { appIconStyle, appInitials } from "~/utils/app-icon";

const props = withDefaults(
  defineProps<{
    name: string;
    logoUrl?: string | null;
  }>(),
  {
    logoUrl: null,
  }
);

const logoFailed = ref(false);

watch(
  () => props.logoUrl,
  () => {
    logoFailed.value = false;
  }
);
</script>

<template>
  <img
    v-if="logoUrl && !logoFailed"
    :src="logoUrl"
    :alt="`${name} logo`"
    class="app-logo app-logo--image"
    @error="logoFailed = true"
  />
  <div v-else class="app-logo" :style="appIconStyle(name)" aria-hidden="true">
    {{ appInitials(name) }}
  </div>
</template>

<style scoped>
.app-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: var(--font-mono);
}

.app-logo--image {
  object-fit: contain;
  padding: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
}
</style>
