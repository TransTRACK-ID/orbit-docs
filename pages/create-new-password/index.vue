<script setup lang="ts">
import { setPageLayout } from "#app";
import { computed, ref, watch } from "vue";

definePageMeta({
  auth: {
    unauthenticatedOnly: true,
    navigateAuthenticatedTo: "/",
  },
  layout: "login",
  layoutTransition: {
    mode: "out-in",
  },
});

const isExpired = ref(false);
const targetLayout = computed(() => (isExpired.value ? false : "login"));

watch(
  targetLayout,
  (newLayout) => {
    setPageLayout(newLayout);
  },
  { immediate: true }
);
</script>

<template>
  <CreateNewPwExpired v-if="isExpired" />
  <CreateNewPw v-else />
</template>
