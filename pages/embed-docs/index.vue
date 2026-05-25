<script setup lang="ts">
definePageMeta({
  auth: true,
});

onMounted(() => {
  navigateTo("/docs", { replace: true });
});
</script>

<template>
  <div />
</template>
