<script setup lang="ts">
import type { PublicWorkspace } from "~/composables/usePublicSupport";

const { fetchWorkspace } = usePublicSupport();
const workspace = ref<PublicWorkspace | null>(null);

onMounted(async () => {
  try {
    workspace.value = await fetchWorkspace();
  } catch {
    workspace.value = null;
  }
});
</script>

<template>
  <div class="support-root">
    <SupportHeader :workspace="workspace" />
    <main class="support-main">
      <slot />
    </main>
    <SupportFooter :workspace="workspace" />
  </div>
</template>
