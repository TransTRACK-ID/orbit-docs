<script setup lang="ts">
import type { PublicWorkspace } from "~/composables/usePublicSupport";
import { appInitials } from "~/utils/app-icon";

defineProps<{
  workspace: PublicWorkspace | null;
}>();

const { status } = useAuth();
const isAuthenticated = computed(() => status.value === "authenticated");
</script>

<template>
  <header class="support-header">
    <NuxtLink to="/" class="support-brand">
      <img
        v-if="workspace?.logoUrl"
        :src="workspace.logoUrl"
        :alt="workspace.name"
        class="support-brand-logo"
      />
      <span v-else class="support-brand-mark" aria-hidden="true">
        {{ workspace ? appInitials(workspace.name) : "OD" }}
      </span>
      <span class="support-brand-copy">
        <span class="support-brand-name">{{ workspace?.name || "Help Center" }}</span>
        <span class="support-brand-sub">Help Center</span>
      </span>
    </NuxtLink>

    <div class="support-header-actions">
      <NuxtLink v-if="isAuthenticated" to="/apps" class="btn btn-secondary btn-sm">
        Dashboard
      </NuxtLink>
      <NuxtLink v-else to="/login" class="btn btn-secondary btn-sm">
        Sign in
      </NuxtLink>
    </div>
  </header>
</template>
