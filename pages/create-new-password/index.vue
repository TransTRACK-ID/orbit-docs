<script setup lang="ts">
import { ref } from "vue";

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
</script>

<template>
  <CreateNewPwExpired v-if="isExpired" />
  <CreateNewPw v-else />
</template>
