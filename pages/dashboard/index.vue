<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: {
    required: true,
  },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Dashboard");
});
</script>

<template>
  <div class="text-gray-500">dashboard pages</div>
</template>
