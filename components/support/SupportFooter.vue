<script setup lang="ts">
import type { PublicWorkspace } from "~/composables/usePublicSupport";

defineProps<{
  workspace: PublicWorkspace | null;
}>();
</script>

<template>
  <footer class="support-footer">
    <div class="support-footer-inner">
      <span>{{ workspace?.name || "Help Center" }}</span>
      <nav class="support-footer-links" aria-label="Footer">
        <NuxtLink to="/p/releases">Release notes</NuxtLink>
        <NuxtLink v-if="workspace" to="/login">Team sign in</NuxtLink>
      </nav>
    </div>
  </footer>
</template>
